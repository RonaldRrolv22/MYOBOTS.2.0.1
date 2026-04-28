/**
 * FirmwareReader
 * --------------
 * Conecta-se a um dispositivo Myobots via Web Bluetooth (Nordic UART Service)
 * e exibe a versão atual do firmware (semver MAJOR.MINOR.PATCH).
 *
 * Handshake de leitura:
 *   1. "C" → aguarda 2000 ms (estabiliza firmware)
 *   2. "S" → aguarda 400 ms (para stream e drena pacotes residuais)
 *   3. "F" → arma resolver e timeout de 2500 ms
 *   4. Acumula RX num buffer (ignora notificações vazias) até casar
 *      /\d+\.\d+\.\d+/ ou estourar o timeout.
 *
 * Todas as operações GATT são serializadas numa única fila de Promises,
 * conforme exigido por stacks BLE de iOS/WebView.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bluetooth,
  BluetoothOff,
  Loader2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

// Returns true when semver string is >= target (e.g. "2.0.1").
function semverAtLeast(version: string | null, target: string): boolean {
  if (!version) return false;
  const parse = (v: string) => v.split('.').map(Number);
  const [ma, mi, pa] = parse(version);
  const [ta, ti, tp] = parse(target);
  if (ma !== ta) return ma > ta;
  if (mi !== ti) return mi > ti;
  return pa >= tp;
}

export interface FirmwareGateState {
  bluetoothSupported: boolean;
  connected: boolean;
  isReading: boolean;
  version: string | null;
}

// ───────────────────────── Constantes do protocolo ──────────────────────────

const NUS_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NUS_TX_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // command (write)
const NUS_RX_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // data (notify)

const NAME_PREFIXES = [
  'Myobox2+',
  'MyoSoftware',
  'Myobots4CH',
  'Myobots',
  'Myobox',
];

const SEMVER_REGEX = /\d+\.\d+\.\d+/;
const FIRMWARE_TIMEOUT_MS = 2500;
const STREAM_DRAIN_MS = 400;
const HANDSHAKE_C_DELAY_MS = 2000;

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

// Tipagens mínimas (Web Bluetooth ainda não está no DOM lib do TS).
type AnyBluetoothDevice = any;
type AnyGattServer = any;
type AnyGattCharacteristic = any;

interface FirmwareReaderProps {
  onFirmwareGateChange?: (state: FirmwareGateState) => void;
}

export default function FirmwareReader({ onFirmwareGateChange }: FirmwareReaderProps) {
  // ─────────────────────────── Estado de UI ────────────────────────────────
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isReadingFirmware, setIsReadingFirmware] = useState(false);

  // ─────────────────────────── Refs internas ───────────────────────────────
  const deviceRef = useRef<AnyBluetoothDevice | null>(null);
  const gattRef = useRef<AnyGattServer | null>(null);
  const commandCharRef = useRef<AnyGattCharacteristic | null>(null);
  const dataCharRef = useRef<AnyGattCharacteristic | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const notificationsStartedRef = useRef(false);
  const firmwareResolverRef = useRef<((semver: string | null) => void) | null>(
    null
  );
  const firmwareTimeoutIdRef = useRef<number | null>(null);
  const firmwareBufferRef = useRef<string>('');
  const onDataRef = useRef<((event: Event) => void) | null>(null);
  const onDisconnectRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const isBluetoothSupported =
    typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;

  // Notifica o componente pai sempre que o estado relevante mudar.
  useEffect(() => {
    onFirmwareGateChange?.({
      bluetoothSupported: isBluetoothSupported,
      connected: connection === 'connected',
      isReading: isReadingFirmware,
      version: firmwareVersion,
    });
  }, [isBluetoothSupported, connection, isReadingFirmware, firmwareVersion, onFirmwareGateChange]);

  // ──────────────────────── Fila serial de GATT ────────────────────────────
  // Cada operação só inicia depois da anterior terminar. Mesmo quando uma
  // rejeita, a fila continua viva (não quebra a cadeia).
  const enqueue = <T,>(op: () => Promise<T>): Promise<T> => {
    const next = queueRef.current.then(() => op());
    queueRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next as Promise<T>;
  };

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  // ────────────────────── Helpers de leitura de versão ─────────────────────
  const clearFirmwarePending = () => {
    if (firmwareTimeoutIdRef.current !== null) {
      clearTimeout(firmwareTimeoutIdRef.current);
      firmwareTimeoutIdRef.current = null;
    }
    firmwareResolverRef.current = null;
    firmwareBufferRef.current = '';
  };

  const safeSetState = <T,>(setter: (v: T) => void, value: T) => {
    if (isMountedRef.current) setter(value);
  };

  // Listener único de RX. Em "modo leitura de versão", acumula notificações
  // num buffer e só resolve quando casa com semver; ignora RX vazias e deixa
  // o timeout decidir se nada útil chegar.
  const handleData = (event: Event) => {
    const target = event.target as AnyGattCharacteristic;
    const value: DataView | undefined = target?.value;
    if (!value || value.byteLength === 0) return;

    if (!firmwareResolverRef.current) return;

    try {
      const bytes = new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      firmwareBufferRef.current += text;
    } catch {
      return;
    }

    const match = firmwareBufferRef.current.match(SEMVER_REGEX);
    if (!match) return;

    const resolver = firmwareResolverRef.current;
    clearFirmwarePending();
    resolver(match[0]);
  };

  const cleanupNotificationListener = () => {
    const char = dataCharRef.current;
    const handler = onDataRef.current;
    if (char && handler) {
      try {
        char.removeEventListener('characteristicvaluechanged', handler);
      } catch {
        /* noop */
      }
    }
  };

  // Reseta todo o estado quando o GATT cai (tanto manual quanto inesperado).
  const handleDisconnect = () => {
    cleanupNotificationListener();

    // Resolve qualquer leitura pendente como null para não vazar Promise.
    if (firmwareResolverRef.current) {
      const resolver = firmwareResolverRef.current;
      clearFirmwarePending();
      resolver(null);
    }

    notificationsStartedRef.current = false;

    const device = deviceRef.current;
    const onDisc = onDisconnectRef.current;
    if (device && onDisc) {
      try {
        device.removeEventListener('gattserverdisconnected', onDisc);
      } catch {
        /* noop */
      }
    }

    deviceRef.current = null;
    gattRef.current = null;
    commandCharRef.current = null;
    dataCharRef.current = null;
    onDataRef.current = null;
    onDisconnectRef.current = null;

    safeSetState(setConnection, 'idle');
    safeSetState(setDeviceName, null);
    safeSetState(setIsReadingFirmware, false);
  };

  // ───────────────────────────── Comandos TX ───────────────────────────────
  const writeCommand = async (cmd: string) => {
    const char = commandCharRef.current;
    if (!char) throw new Error('Comando indisponível: não conectado.');
    const data = new TextEncoder().encode(cmd);
    const props = char.properties || {};
    if (
      props.writeWithoutResponse &&
      typeof char.writeValueWithoutResponse === 'function'
    ) {
      await char.writeValueWithoutResponse(data);
    } else if (typeof char.writeValueWithResponse === 'function') {
      await char.writeValueWithResponse(data);
    } else {
      await char.writeValue(data);
    }
  };

  // ─────────────────────── Leitura da versão (F) ───────────────────────────
  const readFirmwareVersion = (): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      // Evita leituras concorrentes — segue a serialização da fila GATT.
      if (firmwareResolverRef.current) {
        resolve(null);
        return;
      }

      safeSetState(setIsReadingFirmware, true);
      safeSetState(setFirmwareVersion, null);
      firmwareBufferRef.current = '';

      // 1) Handshake: envia C e aguarda o firmware estabilizar.
      enqueue(async () => {
        try {
          await writeCommand('C');
        } catch {
          /* tolera falha — segue para S/F */
        }
      });
      enqueue(async () => {
        await sleep(HANDSHAKE_C_DELAY_MS);
      });

      // 2) Para o stream (caso esteja ativo).
      enqueue(async () => {
        try {
          await writeCommand('S');
        } catch {
          /* tolera falha aqui — o passo F é o que importa */
        }
      });

      // 3) Drena pacotes pendentes do firmware.
      enqueue(async () => {
        await sleep(STREAM_DRAIN_MS);
      });

      // 4) Marca "modo leitura de versão" e dispara F.
      enqueue(async () => {
        firmwareResolverRef.current = (semver) => {
          safeSetState(setFirmwareVersion, semver);
          safeSetState(setIsReadingFirmware, false);
          resolve(semver);
        };

        firmwareTimeoutIdRef.current = window.setTimeout(() => {
          const r = firmwareResolverRef.current;
          clearFirmwarePending();
          if (r) {
            safeSetState(setFirmwareVersion, null);
            safeSetState(setIsReadingFirmware, false);
            resolve(null);
          }
        }, FIRMWARE_TIMEOUT_MS);

        try {
          await writeCommand('F');
        } catch {
          const r = firmwareResolverRef.current;
          clearFirmwarePending();
          if (r) {
            safeSetState(setIsReadingFirmware, false);
            resolve(null);
          }
        }
      });
    });
  };

  // ─────────────────────────── Conexão ─────────────────────────────────────
  const connect = async () => {
    if (!isBluetoothSupported) {
      setLastError(
        'Seu navegador não suporta Web Bluetooth. Use Chrome ou Edge no desktop ou Android.'
      );
      setConnection('error');
      return;
    }

    setLastError(null);
    setFirmwareVersion(null);
    setConnection('connecting');

    try {
      const device: AnyBluetoothDevice = await (
        navigator as any
      ).bluetooth.requestDevice({
        filters: NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
        optionalServices: [NUS_SERVICE_UUID],
      });

      deviceRef.current = device;
      safeSetState(setDeviceName, device.name || 'Myobots');

      // Listener de desconexão (limpa estado).
      onDisconnectRef.current = handleDisconnect;
      device.addEventListener('gattserverdisconnected', handleDisconnect);

      // B) Conectar GATT (via fila).
      const gatt: AnyGattServer = await enqueue(() => device.gatt!.connect());
      gattRef.current = gatt;

      // C) Obter serviço NUS.
      const service: any = await enqueue<any>(() =>
        gatt.getPrimaryService(NUS_SERVICE_UUID)
      );

      // D) Obter características TX e RX.
      const commandChar: AnyGattCharacteristic = await enqueue<any>(() =>
        service.getCharacteristic(NUS_TX_UUID)
      );
      const dataChar: AnyGattCharacteristic = await enqueue<any>(() =>
        service.getCharacteristic(NUS_RX_UUID)
      );
      commandCharRef.current = commandChar;
      dataCharRef.current = dataChar;

      // E) Subscrever notificações apenas UMA vez.
      if (dataChar.properties?.notify && !notificationsStartedRef.current) {
        onDataRef.current = handleData;
        dataChar.addEventListener(
          'characteristicvaluechanged',
          onDataRef.current
        );
        await enqueue(() => dataChar.startNotifications());
        notificationsStartedRef.current = true;
      }

      safeSetState(setConnection, 'connected');

      // Lê a versão automaticamente após conectar.
      await readFirmwareVersion();
    } catch (err: any) {
      const msg = err?.message || String(err);
      const isCancellation =
        err?.name === 'NotFoundError' ||
        /cancel/i.test(msg) ||
        /user cancelled/i.test(msg);

      if (isCancellation) {
        setConnection('idle');
      } else {
        setLastError(msg || 'Erro desconhecido na conexão.');
        setConnection('error');
      }

      // Cleanup defensivo.
      try {
        gattRef.current?.disconnect();
      } catch {
        /* noop */
      }
      handleDisconnect();
    }
  };

  // ───────────────────────── Desconexão manual ─────────────────────────────
  const disconnect = () => {
    try {
      if (gattRef.current?.connected) {
        gattRef.current.disconnect();
      }
    } catch {
      /* noop */
    }
    handleDisconnect();
  };

  // ─────────────── Cleanup global ao desmontar componente ──────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      try {
        if (gattRef.current?.connected) gattRef.current.disconnect();
      } catch {
        /* noop */
      }
      cleanupNotificationListener();
      clearFirmwarePending();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ════════════════════════════════ UI ═════════════════════════════════════
  return (
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-indigo-50/40 p-5 md:p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 shrink-0 rounded-2xl neuro-gradient flex items-center justify-center text-white shadow-md shadow-neuro-blue/20">
          <Cpu className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm md:text-base font-bold text-[#1A1A1A] tracking-tight mb-1">
            Verifique a versão do firmware do seu Myobots
          </h4>
          <p className="text-xs md:text-[13px] text-[#6B6B6B] leading-relaxed">
            Antes de informar o número de série, conecte seu equipamento via{' '}
            <strong className="text-[#1A1A1A] font-semibold">Bluetooth</strong>{' '}
            para identificarmos automaticamente a versão atual e indicar se a
            atualização precisa ser feita por nossa equipe.
          </p>
        </div>
      </div>

      {/* Aviso de navegador sem Web Bluetooth */}
      {!isBluetoothSupported && (
        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
            Seu navegador não suporta Web Bluetooth. Use o{' '}
            <strong>Google Chrome</strong> ou <strong>Microsoft Edge</strong> em
            um computador (ou Android). Em iOS, esse recurso não está
            disponível.
          </p>
        </div>
      )}

      {/* Barra de status / ações */}
      <div className="mt-5">
        <AnimatePresence mode="wait">
          {connection === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <button
                type="button"
                onClick={connect}
                disabled={!isBluetoothSupported}
                className="w-full h-12 rounded-2xl neuro-gradient text-white font-bold text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-neuro-blue/20 hover:shadow-neuro-blue/40 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Bluetooth className="w-4 h-4" />
                CONECTAR MYOBOTS
              </button>
              <p className="text-[10px] text-[#6B6B6B] text-center mt-2 italic">
                Ao clicar, o navegador exibirá a lista de dispositivos
                Bluetooth próximos.
              </p>
            </motion.div>
          )}

          {connection === 'connecting' && (
            <motion.div
              key="connecting"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="h-12 rounded-2xl bg-white border border-blue-100 flex items-center justify-center gap-2.5 text-neuro-blue font-bold text-sm"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Conectando ao Myobots...
            </motion.div>
          )}

          {connection === 'connected' && (
            <motion.div
              key="connected"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              {/* Card com a versão */}
              <div className="rounded-2xl bg-white border border-gray-100 p-4 flex items-center gap-4">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-[0.18em] mb-0.5">
                    {deviceName ?? 'Myobots'} • Conectado
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-wider">
                      Firmware
                    </span>
                    {isReadingFirmware ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-neuro-blue">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Lendo versão...
                      </span>
                    ) : firmwareVersion ? (
                      <span className="font-mono font-bold text-base text-[#1A1A1A] tracking-tight">
                        v{firmwareVersion}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-amber-600">
                        Não detectada
                      </span>
                    )}
                  </div>
                </div>

                {!isReadingFirmware && (
                  <button
                    type="button"
                    onClick={readFirmwareVersion}
                    title="Ler novamente"
                    className="w-9 h-9 shrink-0 rounded-xl border border-gray-200 bg-white text-[#6B6B6B] hover:text-neuro-blue hover:border-neuro-blue/40 transition-all flex items-center justify-center"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Aviso quando versão não pôde ser lida */}
              {!isReadingFirmware && firmwareVersion === null && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    Não foi possível ler a versão do firmware. Tente novamente
                    ou utilize o número de série abaixo para que possamos
                    identificar manualmente.
                  </p>
                </div>
              )}

              {/* Banner verde: firmware já atende aos requisitos (≥ 2.0.1) */}
              <AnimatePresence>
                {!isReadingFirmware && semverAtLeast(firmwareVersion, '2.0.1') && (
                  <motion.div
                    key="fw-ok"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="p-3.5 rounded-xl bg-green-50 border border-green-200 flex gap-2.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-green-800 leading-relaxed font-semibold">
                      A versão do seu Myobots já atende aos requisitos e seu equipamento não precisará ser enviado.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="button"
                onClick={disconnect}
                className="w-full h-11 rounded-2xl bg-white border border-gray-200 text-[#6B6B6B] font-semibold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 hover:border-red-200 hover:text-red-500 hover:bg-red-50/50 transition-all"
              >
                <BluetoothOff className="w-4 h-4" />
                Desconectar
              </button>
            </motion.div>
          )}

          {connection === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-900 leading-relaxed font-medium">
                  {lastError ?? 'Não foi possível conectar ao Myobots.'}
                </p>
              </div>
              <button
                type="button"
                onClick={connect}
                className="w-full h-11 rounded-2xl neuro-gradient text-white font-bold text-xs tracking-[0.15em] uppercase flex items-center justify-center gap-2 shadow-md shadow-neuro-blue/20 active:scale-[0.99] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
