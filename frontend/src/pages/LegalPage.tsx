import PublicHeader from '../components/PublicHeader'
import privacyPolicy from '../content/privacy-policy.txt?raw'
import termsOfService from '../content/terms-of-service.txt?raw'

type LegalPageProps = {
  type: 'privacy' | 'terms'
}

const legalContent = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'This Privacy Policy explains how Rentivo collects, uses, and protects information when you use our website and services.',
    sections: [
      ['Information we collect', 'We may collect account details, company information, contact details, and information you provide while using Rentivo. We also collect limited technical information needed to keep the service secure and reliable.'],
      ['How we use information', 'We use information to provide and improve Rentivo, manage accounts, respond to support requests, protect the service, and communicate important service updates.'],
      ['Your choices', 'You may contact us to request access to, correction of, or information about the personal data associated with your account.'],
      ['Contact', 'For privacy questions or requests, please contact the Rentivo team through the contact details provided on our website.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'These Terms and Conditions govern your access to and use of the Rentivo website and services.',
    sections: [
      ['Using Rentivo', 'You are responsible for providing accurate account information, keeping your credentials secure, and using Rentivo in accordance with applicable laws.'],
      ['Your business data', 'You retain responsibility for the accuracy, permissions, and lawful use of the business and customer information you enter into Rentivo.'],
      ['Service availability', 'We work to keep Rentivo available and secure, but maintenance, updates, or circumstances outside our control may occasionally affect availability.'],
      ['Contact', 'If you have questions about these terms, please contact the Rentivo team through the contact details provided on our website.'],
    ],
  },
} as const

function LegalDocumentContent({ source }: { source: string }) {
  return (
    <div className="space-y-3">
      {source.split(/\r?\n/).slice(1).map((line, index) => {
        const trimmedLine = line.trim()
        const plainLine = trimmedLine.replace(/\*\*/g, '')

        if (!trimmedLine) return <div key={`space-${index}`} className="h-2" aria-hidden="true" />
        if (trimmedLine.startsWith('## ')) {
          const heading = plainLine.slice(3)
          const headingId = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          return <h2 id={headingId} key={index} className="scroll-mt-24 pt-6 text-xl font-bold text-[#21142f]">{heading}</h2>
        }
        if (trimmedLine.startsWith('### ')) return <h3 key={index} className="pt-4 text-lg font-bold text-[#21142f]">{plainLine.slice(4)}</h3>
        if (trimmedLine.startsWith('- ')) return <p key={index} className="pl-5 leading-7 text-[#686173] before:mr-2 before:content-['•']">{plainLine.slice(2)}</p>
        if (trimmedLine.startsWith('**')) return <p key={index} className="font-semibold leading-7 text-[#21142f]">{plainLine}</p>
        return <p key={index} className="leading-7 text-[#686173]">{plainLine}</p>
      })}
    </div>
  )
}

function getLegalHeadings(source: string) {
  return source
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('## '))
    .map((line) => {
      const heading = line.trim().replace(/^##\s+/, '')
      return {
        label: heading,
        id: heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      }
    })
}

export default function LegalPage({ type }: LegalPageProps) {
  const content = legalContent[type]
  const documentSource = type === 'terms' ? termsOfService : privacyPolicy
  const legalHeadings = getLegalHeadings(documentSource)

  return (
    <main className="min-h-screen bg-[#f7f6fb] text-[#17141f]">
      <PublicHeader />
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5b21b6]">Rentivo</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#21142f] sm:text-5xl">{content.title}</h1>
          <div className="mt-12 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-[#2c0f73]/10 bg-white p-5 shadow-[0_8px_24px_rgba(45,28,82,0.05)] lg:sticky lg:top-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5b21b6]">On this page</p>
              <nav aria-label={`${content.title} sections`} className="mt-4 max-h-64 space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-7rem)]">
                {legalHeadings.map((heading) => (
                  <a key={heading.id} href={`#${heading.id}`} className="block rounded-lg px-3 py-2 text-sm font-semibold leading-5 text-[#686173] transition hover:bg-[#f7f6fb] hover:text-[#5b21b6]">
                    {heading.label}
                  </a>
                ))}
              </nav>
            </aside>
            <article className="rounded-2xl border border-[#2c0f73]/10 bg-white p-6 shadow-[0_8px_24px_rgba(45,28,82,0.05)] sm:p-10">
              <LegalDocumentContent source={documentSource} />
            </article>
          </div>
        </div>
      </section>
      <footer className="border-t border-[#2c0f73]/10 bg-[#21142f] px-6 py-10 text-[#ede9fe] sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold text-white">Rentivo</p>
            <p className="mt-1 text-sm text-[#c4b5fd]">Rental operations, organized.</p>
          </div>
          <nav aria-label="Legal navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold">
            <a href="/privacy-policy" className="cursor-pointer transition hover:text-white">Privacy Policy</a>
            <a href="/terms-and-conditions" className="cursor-pointer transition hover:text-white">Terms and Conditions</a>
          </nav>
        </div>
      </footer>
    </main>
  )
}
