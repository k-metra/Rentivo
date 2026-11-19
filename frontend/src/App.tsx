import wordmark from './assets/rentivo-wordmark.png'

export default function App() {
  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <header className="flex h-20 items-center border-b border-[#2c0f73]/10 bg-white px-6 sm:px-10">
        <img src={wordmark} alt="Rentivo" className="h-12 w-auto" />
      </header>
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Fleet operations</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-[#21142f] sm:text-6xl">
            Rental operations, organized.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-[#686173]">
            Rentivo brings fleet, booking, customer, payment, and POS workflows into one independent SaaS workspace.
          </p>
        </div>
      </section>
    </main>
  )
}
