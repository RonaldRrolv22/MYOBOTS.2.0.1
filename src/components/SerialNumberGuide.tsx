import { motion } from 'motion/react';

export default function SerialNumberGuide() {
  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-[28px] border border-gray-100 shadow-sm overflow-visible scale-75 sm:scale-90 origin-top">
      {/* Header Instructions */}
      <header className="w-full text-left mb-6 px-2">
        <p className="text-[10px] font-medium leading-tight text-gray-500 max-w-[180px]">
          <span className="font-bold uppercase">Número de Série: FORMATO XXXXM</span> (ex: <span className="font-bold text-gray-900">1006M</span>)
        </p>
      </header>

      {/* Main Device Layout */}
      <main className="relative flex flex-col items-center pr-12">
        {/* Device Chassis */}
        <div className="device-body w-48 h-[260px] rounded-[30px] border border-gray-400 p-4 flex flex-col items-center relative overflow-hidden">
          {/* Structural Screws */}
          <div className="absolute top-4 left-4 w-1.5 h-1.5 rounded-full bg-gray-500 shadow-inner"></div>
          <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-gray-500 shadow-inner"></div>
          <div className="absolute bottom-4 left-4 w-1.5 h-1.5 rounded-full bg-gray-500 shadow-inner"></div>
          <div className="absolute bottom-4 right-4 w-1.5 h-1.5 rounded-full bg-gray-500 shadow-inner"></div>

          {/* Upper Panel Icons & SN Area */}
          <div className="w-full mt-2 flex flex-col items-center">
            <div className="bg-white/50 rounded-md p-1 border border-gray-300 w-fit flex items-center gap-1.5">
              {/* Icons Grid */}
              <div className="flex items-center gap-1 border-r border-gray-400 pr-1.5">
                <div className="w-3 h-3 border-2 border-black p-0.5 flex items-center justify-center">
                  <div className="w-full h-full border border-black"></div>
                </div>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect height="15" width="14" x="5" y="6"></rect>
                  <line x1="3" x2="21" y1="6" y2="6"></line>
                  <line x1="10" x2="14" y1="2" y2="2"></line>
                  <line stroke="red" strokeWidth="1.5" x1="4" x2="20" y1="4" y2="20"></line>
                </svg>
                <div className="w-3 h-3 rounded-full bg-blue-600 flex items-center justify-center text-white">
                  <span className="text-[4px] font-bold">i</span>
                </div>
              </div>
              {/* Serial Number Target Area */}
              <div className="flex flex-col items-center">
                <span className="text-[4px] font-bold self-start">SET/25</span>
                <div className="border border-dashed border-red-500 px-0.5 rounded-sm">
                  <span className="text-[6px] font-bold">SN 1006M</span>
                </div>
              </div>
            </div>
          </div>

          {/* Connectors Section */}
          <div className="mt-4 grid grid-cols-1 gap-4 justify-items-center">
            <div className="connector w-10 h-10 rounded-full flex items-center justify-center">
              <div className="connector-inner w-6 h-6 rounded-full"></div>
            </div>
            <div className="flex gap-4">
              <div className="connector w-10 h-10 rounded-full flex items-center justify-center">
                <div className="connector-inner w-6 h-6 rounded-full"></div>
              </div>
              <div className="connector w-10 h-10 rounded-full flex items-center justify-center">
                <div className="connector-inner w-6 h-6 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Technical Label Sticker */}
          <div className="absolute bottom-4 w-[85%] bg-gray-200/80 border border-gray-400 rounded-md p-1.5 flex flex-col text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 20h16v-2h-2v-4h-2v4h-2v-7h-2v7H8v-9H6v9H4v2zm0-18v2h16V2H4z"></path></svg>
              <div className="text-left leading-none">
                <p className="text-[5px] font-bold">Neurobot P&D LTDA</p>
                <p className="text-[4px] text-gray-600">neurobeta.com.br</p>
              </div>
            </div>
            <div className="border-t border-gray-300 pt-0.5 mt-0.5 text-[4px] text-left leading-tight">
              <p>Modelo: <span className="font-semibold">Myoboto</span></p>
              <p>Tensão: <span className="font-semibold">5V</span> | Freq: <span className="font-semibold">0Hz</span></p>
              <p className="font-bold">ANATEL: 08479-24-17384</p>
            </div>
          </div>
        </div>

        {/* Zoom Callout Box */}
        <div className="absolute left-[85%] top-10 bg-white border-2 border-red-500 rounded shadow-xl p-1.5 z-10 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold tracking-widest bg-gray-50 border border-gray-200 px-1 py-0.5">SN 1006M</span>
          </div>
        </div>
      </main>
    </div>
  );
}
