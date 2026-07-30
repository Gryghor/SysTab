import Image from "next/image"

export function Footer() {
  return (
    <div data-systab-footer className="fixed bottom-6 right-6 z-20">
      <div className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#0948a7] to-[#1c7ab8] p-2.5 text-white shadow-lg transition-all duration-300 hover:shadow-xl xl:p-3 xl:hover:scale-105">
        <div className="hidden overflow-hidden whitespace-nowrap text-xs opacity-0 transition-all duration-300 xl:block xl:max-w-0 xl:group-hover:max-w-xs xl:group-hover:opacity-100">
          <p>Gerenciador de Tablets do GTI da Sec. de Saúde</p>
          <p>Jaboatão dos Guararapes - Março de 2025 - Ver: 3.3.3</p>
          <p>
            Clique{" "}
            <a href="https://github.com/pedrormelo/SysTab" className="font-bold underline transition-colors hover:text-blue-200">
              aqui
            </a>{" "}
            para saber mais do projeto.
          </p>
        </div>

        <div className="shrink-0 rounded-lg bg-white p-1.5 transition-transform duration-300 xl:p-2 xl:group-hover:rotate-3 xl:group-hover:scale-110">
          <Image src="/qr-code.svg" alt="QR Code" width={80} height={80} className="h-14 w-14 xl:h-20 xl:w-20" />
        </div>
      </div>
    </div>
  )
}
