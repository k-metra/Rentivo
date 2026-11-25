import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, FontFamily, FontSize, Color } from '@tiptap/extension-text-style'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table'
import { TableHeader, TableCell } from '@tiptap/extension-table'
import { Mark, mergeAttributes, Node } from '@tiptap/core'
import SearchableSelect from '../SearchableSelect'
import { useSubscriptionReadOnly } from './SubscriptionReadOnlyContext'

type ContractBuilderSectionProps = {
  title: string
  content: string
  electronicSignatureEnabled?: boolean
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onDirtyChange: (dirty: boolean) => void
  onSave: () => void
}

const DynamicField = Mark.create({
  name: 'dynamicField',
  inclusive: false,
  addAttributes() {
    return {
      key: { default: null },
      label: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-dynamic-field]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, {
      'data-dynamic-field': HTMLAttributes.key,
      class: 'contract-dynamic-field',
    }), 0]
  },
})

const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true', class: 'contract-page-break' })]
  },
})

const dynamicGroups: Record<string, Array<{ key: string; label: string }>> = {
  'Dates': [
    { key: 'date_today', label: 'Date Today' },
    { key: 'date_created', label: 'Date Created' },
  ],
  'Booking': [
    { key: 'booking_remarks', label: 'Booking Remarks' },
    { key: 'rental_start_date_time', label: 'Rental Start Date & Time' },
    { key: 'rental_end_date_time', label: 'Rental End Date & Time' },
    { key: 'destination', label: 'Destination' },
  ],
  'Renter': [
    { key: 'renter_name', label: 'Renter Name' },
    { key: 'renter_address', label: 'Renter Address' },
    { key: 'renter_contact_number', label: 'Renter Contact Number' },
    { key: 'renter_email_address', label: 'Renter Email Address' },
  ],
  'Vehicle': [
    { key: 'vehicle_brand', label: 'Vehicle Brand' },
    { key: 'vehicle_name', label: 'Vehicle Name' },
    { key: 'vehicle_model', label: 'Vehicle Model' },
    { key: 'vehicle_plate_number', label: 'Vehicle Plate Number' },
    { key: 'vehicle_color', label: 'Vehicle Color' },
    { key: 'vehicle_year', label: 'Vehicle Year' },
    { key: 'vehicle_fuel_type', label: 'Vehicle Fuel Type' },
  ],
  'Rental': [
    { key: 'rental_daily_rate', label: 'Rental Daily Rate' },
    { key: 'rental_days_rented', label: 'Rental Days Rented' },
    { key: 'rental_extend_hours', label: 'Rental Extend Hours' },
    { key: 'rental_hourly_extension_fee', label: 'Rental Hourly Extension Fee' },
    { key: 'total_rent_due', label: 'Total Rent Due' },
    { key: 'security_deposit', label: 'Security Deposit' },
    { key: 'discounts_if_any', label: 'Discounts if Any' },
    { key: 'autosweep_rfid_balance', label: 'Autosweep RFID Balance' },
    { key: 'easytrip_rfid_balance', label: 'Easytrip RFID Balance' },
    { key: 'carwash_fee', label: 'Carwash Fee' },
  ],
  'Payment': [
    { key: 'payment_summary_overall_total_due', label: 'Payment Summary Overall Total Due' },
    { key: 'paid_amount', label: 'Paid Amount' },
    { key: 'balance', label: 'Balance' },
  ],
  'Signatories': [
    { key: 'renter_signature', label: 'Renter Signature' },
    { key: 'staff_signature', label: 'Staff / Authorized Representative Signature' },
  ],
}

const fontOptions = ['Poppins', 'Roboto Mono', 'Lobster', 'Arial', 'Courier New', 'Times New Roman']
const fontSizeOptions = ['9px', '10px', '11px', '12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px', '48px']

const stripContractImages = (html: string) =>
  html
    .replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, '')
    .replace(/<img\b[^>]*\/?>/gi, '')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, '')

export function ContractBuilderSection({
  title,
  content,
  electronicSignatureEnabled = false,
  onTitleChange,
  onContentChange,
  onDirtyChange,
  onSave,
}: ContractBuilderSectionProps) {
  const prefersReducedMotion = useReducedMotion()
  const subscriptionReadOnly = useSubscriptionReadOnly()
  const [fontFamily, setFontFamily] = useState('Poppins')
  const [fontSize, setFontSize] = useState('16px')
  const [textColor, setTextColor] = useState('#21142f')
  const [margins, setMargins] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rentivo_contract_margins') || '{"top":20,"right":20,"bottom":20,"left":20}')
    } catch {
      return { top: 20, right: 20, bottom: 20, left: 20 }
    }
  })
  const [zoom, setZoom] = useState(90)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [saveError, setSaveError] = useState('')
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false)
  const previewWindowRef = useRef<Window | null>(null)


  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      DynamicField,
      PageBreak,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: stripContractImages(content) || '<p></p>',
    editable: !subscriptionReadOnly,
    immediatelyRender: false,
    onUpdate({ editor: currentEditor }: { editor: any }) {
      const nextContent = stripContractImages(currentEditor.getHTML())
      onContentChange(nextContent)
      onDirtyChange(true)
    },
  })

  useEffect(() => {
    editor?.setEditable(!subscriptionReadOnly)
  }, [editor, subscriptionReadOnly])

  useEffect(() => {
    if (!editor) return
    const sanitizedContent = stripContractImages(content)
    if (editor.getHTML() === sanitizedContent) return
    editor.commands.setContent(sanitizedContent || '<p></p>', { emitUpdate: false })
  }, [content, editor])




  useEffect(() => {
    localStorage.setItem('rentivo_contract_margins', JSON.stringify(margins))
  }, [margins])

  useEffect(() => {
    if (!editor) return
    editor.view.dom.style.fontFamily = `"${fontFamily}", sans-serif`
    editor.view.dom.style.fontSize = fontSize
  }, [editor, fontFamily, fontSize])

  const printContract = async () => {
    if (document.fonts?.ready) await document.fonts.ready
    window.print()
  }

  const insertDynamicField = (field: { key: string; label: string }) => {
    if (!editor) return
    editor.chain().focus().insertContent({
      type: 'text',
      text: `{{${field.key}}}`,
      marks: [{ type: 'dynamicField', attrs: { key: field.key, label: field.label } }],
    }).run()
  }


  const updateMargin = (side: 'top' | 'right' | 'bottom' | 'left', value: string) => {
    const parsed = Math.max(0, Math.min(60, Number(value) || 0))
    setMargins((current: typeof margins) => ({ ...current, [side]: parsed }))
    onDirtyChange(true)
  }

  const handleSave = () => {
    const missingSignatories = [
      !content.includes('{{renter_signature}}') ? 'Renter Signature' : '',
      !content.includes('{{staff_signature}}') ? 'Staff / Authorized Representative Signature' : '',
    ].filter(Boolean)

    if (missingSignatories.length) {
      setSaveError(`Add both signatories before saving: ${missingSignatories.join(' and ')}.`)
      return
    }

    setSaveError('')
    setSaveStatus('saving')
    window.setTimeout(() => {
      onSave()
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 3000)
    }, 120)
  }

  const previewValues: Record<string, string> = {
    date_today: new Date().toLocaleDateString('en-PH'),
    date_created: new Date().toLocaleDateString('en-PH'),
    booking_remarks: 'Pickup from the main office',
    renter_name: 'Juan dela Cruz',
    renter_address: '123 Sample Street, Makati',
    renter_contact_number: '+63 900 000 0000',
    renter_email_address: 'juan@example.com',
    rental_start_date_time: 'Nov 23, 2026 8:00 AM',
    rental_end_date_time: 'Nov 24, 2026 8:00 AM',
    destination: 'Makati, Metro Manila',
    vehicle_brand: 'Toyota',
    vehicle_name: 'Luna',
    vehicle_model: 'Wigo G',
    vehicle_plate_number: 'DAR 1519',
    vehicle_color: 'White',
    vehicle_year: '2023',
    vehicle_fuel_type: 'Unleaded 91',
    rental_daily_rate: '₱1,695.00',
    rental_days_rented: '1',
    rental_extend_hours: '0',
    rental_hourly_extension_fee: '₱220.00',
    total_rent_due: '₱1,695.00',
    security_deposit: '₱0.00',
    discounts_if_any: 'None',
    autosweep_rfid_balance: '₱500.00',
    easytrip_rfid_balance: '₱500.00',
    carwash_fee: '₱200.00',
    payment_summary_overall_total_due: '₱1,695.00',
    paid_amount: '₱1,695.00',
    balance: '₱0.00',
    renter_signature: electronicSignatureEnabled
      ? '<div style="border-bottom:1px solid #17141f;height:64px;width:220px"></div><div style="font-size:12px;margin-top:6px">Renter e-signature</div>'
      : '<div style="border-bottom:1px solid #17141f;width:220px;height:40px"></div><div style="font-size:12px;margin-top:6px">Renter signature</div>',
    staff_signature: electronicSignatureEnabled
      ? '<div style="border-bottom:1px solid #17141f;height:64px;width:220px"></div><div style="font-size:12px;margin-top:6px">Staff / authorized representative e-signature</div>'
      : '<div style="border-bottom:1px solid #17141f;width:220px;height:40px"></div><div style="font-size:12px;margin-top:6px">Staff / authorized representative signature</div>',
  }

  const previewHtml = (() => {
    let html = stripContractImages(editor?.getHTML() ?? content)
    Object.entries(previewValues).forEach(([key, value]) => {
      html = html.replaceAll(`{{${key}}}`, value)
    })
    return html.replace(/<span[^>]*data-dynamic-field="[^"]*"[^>]*>(.*?)<\/span>/gi, '$1')
  })()

  const previewDocumentHtml = () => `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title || 'Contract Preview'}</title>
        <style>
          @page { size: A4; margin: 0; }
          html, body { margin: 0; background: #e5e7eb; }
          .sheet { box-sizing: border-box; width: 210mm; min-height: 297mm; margin: 24px auto; background: #fff; box-shadow: 0 12px 40px rgba(45,28,82,.16); padding: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; font-family: "${fontFamily}", sans-serif; font-size: ${fontSize}; color: #17141f; }
          table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #d1d5db; padding: 8px; } th { background: #f7f6fb; }
          [data-dynamic-field], .contract-dynamic-field { background: transparent; color: inherit; border-radius: 0; padding: 0; font-weight: inherit; }
          .contract-page-break { page-break-after: always; height: 1px; }
          @media print { html, body { background: #fff; } .sheet { margin: 0; box-shadow: none; } }
        </style>
      </head>
      <body>
        <article class="sheet">
          <div style="position:relative;">${previewHtml}</div>
        </article>
      </body>
    </html>`

  const openPreviewDrawer = () => setPreviewDrawerOpen(true)

  const openPreviewWindow = () => {
    if (previewWindowRef.current && !previewWindowRef.current.closed) {
      previewWindowRef.current.focus()
      previewWindowRef.current.document.open()
      previewWindowRef.current.document.write(previewDocumentHtml())
      previewWindowRef.current.document.close()
      return
    }
    previewWindowRef.current = window.open('', '_blank', 'width=1000,height=900')
    if (!previewWindowRef.current) return
    previewWindowRef.current.document.open()
    previewWindowRef.current.document.write(previewDocumentHtml())
    previewWindowRef.current.document.close()
  }

  useEffect(() => {
    if (!previewWindowRef.current || previewWindowRef.current.closed) return
    const timer = window.setTimeout(() => {
      if (!previewWindowRef.current || previewWindowRef.current.closed) return
      previewWindowRef.current.document.open()
      previewWindowRef.current.document.write(previewDocumentHtml())
      previewWindowRef.current.document.close()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [content, title, fontFamily, fontSize, margins, previewHtml])

  const buttonClass = (active = false) =>
    `flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md border px-2 text-sm font-semibold transition ${active ? 'border-[#c4b5fd] bg-[#ede9fe] text-[#5b21b6]' : 'border-transparent text-[#40384b] hover:border-[#dcd8e6] hover:bg-[#f7f6fb]'}`

  return (
    <motion.section
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-[calc(100vh-180px)] flex-col"
    >
      <style>{`
        .contract-editor .ProseMirror { position: relative; z-index: 1; min-height: 1122px; outline: none; font-family: inherit; font-size: inherit; }
        .contract-editor .ProseMirror table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 12px 0; }
        .contract-editor .ProseMirror th, .contract-editor .ProseMirror td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
        .contract-editor .ProseMirror th { background: #f7f6fb; font-weight: 700; }
        .contract-editor .contract-dynamic-field { background: #ede9fe; color: #5b21b6; border-radius: 4px; padding: 1px 4px; font-weight: 700; white-space: nowrap; }
        .contract-editor .contract-page-break { height: 1px; border-top: 2px dashed #c4b5fd; margin: 28px 0; page-break-after: always; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .contract-print-area, .contract-print-area * { visibility: visible !important; }
          .contract-print-area { position: absolute; inset: 0; width: 210mm; min-height: 297mm; margin: 0 !important; box-shadow: none !important; transform: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .contract-editor, .contract-editor * { font-synthesis: weight style; }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeaf3] pb-5">
        <div>
          <h2 className="text-2xl font-semibold">Contract Builder</h2>
          <p className="mt-1 text-sm text-[#8b8494]">Create templates with live booking fields</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={openPreviewDrawer} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#5b21b6]">Preview</button>
          <button type="button" onClick={openPreviewWindow} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Open preview window</button>
          <button type="button" onClick={() => void printContract()} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-4 py-2.5 text-sm font-bold text-[#686173]">Print</button>
          <button type="button" disabled={saveStatus === 'saving' || subscriptionReadOnly} onClick={handleSave} title={subscriptionReadOnly ? 'Renew your subscription to make changes.' : undefined} className="min-w-36 cursor-pointer rounded-lg bg-[#5b21b6] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save template'}
          </button>
        </div>
      </div>
      {saveError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {saveError}
        </div>
      )}

      <div className="mt-5 grid min-h-0 flex-1 gap-5 xl:grid-cols-[220px_minmax(520px,1fr)]">
        <aside className="h-fit rounded-xl border border-[#2c0f73]/10 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8b8494]">Dynamic fields</p>
          <div className="mt-3 max-h-[calc(100vh-230px)] space-y-4 overflow-y-auto pr-1">
            {Object.entries(dynamicGroups).map(([group, fields]) => (
              <div key={group}>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#686173]">{group}</p>
                <div className="space-y-1.5">
                  {fields.map((field) => (
                    <button type="button" key={field.key} disabled={subscriptionReadOnly} onClick={() => insertDynamicField(field)} className="w-full cursor-pointer rounded-lg border border-[#e5e1ed] px-3 py-2 text-left text-xs font-semibold text-[#40384b] transition hover:border-[#c4b5fd] hover:bg-[#f7f6fb] hover:text-[#5b21b6] disabled:cursor-not-allowed disabled:opacity-50">+ {field.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <label className="mb-4 block">
            <span className="mb-2 block text-sm font-semibold">Template title</span>
            <input value={title} readOnly={subscriptionReadOnly} onChange={(event) => { onTitleChange(event.target.value); onDirtyChange(true) }} className="w-full rounded-lg border border-[#dcd8e6] bg-white px-4 py-3 outline-none focus:border-[#6d28d9] read-only:bg-[#f7f6fb]" />
          </label>

          <fieldset disabled={subscriptionReadOnly} className="contents">
          <div className="sticky top-[76px] z-20 mb-3 flex flex-wrap items-center gap-1 rounded-xl border border-[#dcd8e6] bg-white p-2 shadow-[0_8px_24px_rgba(45,28,82,0.08)]">
            <button type="button" onClick={() => editor?.chain().focus().undo().run()} disabled={!editor?.can().undo()} className={buttonClass()} title="Undo">↶</button>
            <button type="button" onClick={() => editor?.chain().focus().redo().run()} disabled={!editor?.can().redo()} className={buttonClass()} title="Redo">↷</button>
            <span className="mx-1 h-6 w-px bg-[#eeeaf3]" />
            <div className="w-36"><SearchableSelect name="contract_font" value={fontFamily} placeholder="Font" options={fontOptions} onChange={(value) => { setFontFamily(value); editor?.chain().focus().setFontFamily(value).run() }} /></div>
            <div className="w-24"><SearchableSelect name="contract_font_size" value={fontSize} placeholder="Size" options={fontSizeOptions.map((size) => ({ value: size, label: size.replace('px', '') }))} onChange={(value) => { setFontSize(value); (editor?.chain().focus() as any).setFontSize(value).run() }} /></div>
            <span className="mx-1 h-6 w-px bg-[#eeeaf3]" />
            <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={buttonClass(editor?.isActive('bold'))} title="Bold"><strong>B</strong></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={buttonClass(editor?.isActive('italic'))} title="Italic"><em>I</em></button>
            <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} className={buttonClass(editor?.isActive('underline'))} title="Underline"><u>U</u></button>
            <label className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent hover:border-[#dcd8e6] hover:bg-[#f7f6fb]" title="Text color">
              <span className="text-sm font-bold">A</span><span className="absolute bottom-1 h-1 w-4 rounded-full" style={{ backgroundColor: textColor }} />
              <input type="color" value={textColor} onChange={(event) => { setTextColor(event.target.value); editor?.chain().focus().setColor(event.target.value).run() }} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
            <span className="mx-1 h-6 w-px bg-[#eeeaf3]" />
            <button type="button" onClick={() => editor?.chain().focus().setParagraph().run()} className={buttonClass(editor?.isActive('paragraph'))} title="Paragraph">P</button>
            {[1, 2, 3].map((level) => <button type="button" key={level} onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()} className={buttonClass(editor?.isActive('heading', { level }))} title={`Heading ${level}`}>H{level}</button>)}
            <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={buttonClass(editor?.isActive('bulletList'))} title="Bulleted list">•≡</button>
            <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={buttonClass(editor?.isActive('orderedList'))} title="Numbered list">1.</button>
            <span className="mx-1 h-6 w-px bg-[#eeeaf3]" />
            {(['left', 'center', 'right', 'justify'] as const).map((alignment) => <button type="button" key={alignment} onClick={() => editor?.chain().focus().setTextAlign(alignment).run()} className={buttonClass(editor?.isActive({ textAlign: alignment }))} title={`Align ${alignment}`}>{alignment === 'left' ? '≡' : alignment === 'center' ? '≣' : alignment === 'right' ? '≡' : '▤'}</button>)}
            <span className="mx-1 h-6 w-px bg-[#eeeaf3]" />
            <button type="button" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={buttonClass()} title="Insert table">▦</button>
            {editor?.isActive('table') && (
              <>
                <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={buttonClass()} title="Add table column">+C</button>
                <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={buttonClass()} title="Delete table column">-C</button>
                <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={buttonClass()} title="Add table row">+R</button>
                <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={buttonClass()} title="Delete table row">-R</button>
                <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={buttonClass()} title="Delete table">×T</button>
              </>
            )}
            <button type="button" onClick={() => editor?.chain().focus().insertContent({ type: 'pageBreak' }).run()} className={buttonClass()} title="Insert page break">⇥</button>
          </div>
          </fieldset>

          <div
            className="overflow-auto rounded-xl border border-[#dcd8e6] bg-[#eceaf0] p-6 sm:p-10"
          >
            <div
              className="contract-print-area contract-editor mx-auto origin-top bg-white shadow-[0_18px_50px_rgba(45,28,82,0.16)]"
              style={{
                width: '210mm',
                minHeight: '297mm',
                position: 'relative',
                fontFamily: `"${fontFamily}", sans-serif`,
                fontSize: '16px',
                paddingTop: `${margins.top}mm`,
                paddingRight: `${margins.right}mm`,
                paddingBottom: `${margins.bottom}mm`,
                paddingLeft: `${margins.left}mm`,
                transform: `scale(${zoom / 100})`,
                marginBottom: `${-297 * (1 - zoom / 100)}mm`,
              }}
            >
              <EditorContent editor={editor} />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2c0f73]/10 bg-white p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                  <label key={side}>
                    <span className="mb-1 block text-[11px] font-semibold capitalize text-[#686173]">{side}</span>
                    <div className="relative"><input type="number" min="0" max="60" value={margins[side]} onChange={(event) => updateMargin(side, event.target.value)} className="w-24 rounded-lg border border-[#dcd8e6] px-2 py-2 pr-7 text-xs" /><span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#8b8494]">mm</span></div>
                  </label>
                ))}
              </div>
              <label className="flex w-56 items-center gap-3"><span className="text-xs font-semibold text-[#686173]">Editor zoom</span><input type="range" min="60" max="120" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1 accent-[#5b21b6]" /><span className="w-10 text-right text-xs font-semibold text-[#5b21b6]">{zoom}%</span></label>
            </div>
          </div>
        </div>

      </div>

      {previewDrawerOpen && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-[#17141f]/45"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewDrawerOpen(false)
          }}
        >
          <motion.aside
            initial={prefersReducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? undefined : { x: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-y-0 right-0 flex w-full max-w-4xl flex-col bg-[#eceaf0] shadow-[-24px_0_60px_rgba(45,28,82,0.18)]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[#dcd8e6] bg-white px-5 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#5b21b6]">Live preview</p>
                <h3 className="mt-1 text-lg font-bold">{title || 'Contract preview'}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={openPreviewWindow} className="cursor-pointer rounded-lg border border-[#dcd8e6] px-3 py-2 text-xs font-bold text-[#686173]">Open window</button>
                <button type="button" onClick={() => setPreviewDrawerOpen(false)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-xl text-[#686173] hover:bg-[#f7f6fb]" aria-label="Close preview">×</button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-6 sm:p-10">
              <article
                className="mx-auto min-h-[297mm] w-[210mm] bg-white shadow-[0_18px_50px_rgba(45,28,82,0.16)]"
                style={{
                  boxSizing: 'border-box',
                  position: 'relative',
                  padding: `${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm`,
                  fontFamily: `"${fontFamily}", sans-serif`,
                  fontSize,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                  }}
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </article>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </motion.section>
  )
}
