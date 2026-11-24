import { Link } from '@tanstack/react-router'
import LegalPage from '#/components/legal/LegalPage'
import type { LegalSection } from '#/components/legal/LegalPage'
import { BRAND_NAME } from '#/lib/config'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

export const TERMS_UPDATED = '16 November 2026'

const SECTIONS_EN: LegalSection[] = [
  {
    id: 'your-account',
    title: 'Your account',
    body: (
      <ul>
        <li>You must give a valid email address and keep it up to date.</li>
        <li>
          Keep your password safe. You are responsible for what happens under
          your account.
        </li>
        <li>
          You must be old enough to enter a contract where you live, or have
          permission from a parent or guardian.
        </li>
      </ul>
    ),
  },
  {
    id: 'services',
    title: 'Our services',
    body: (
      <p>
        {BRAND_NAME} offers custom software work, hosted business applications
        sold as subscriptions, one-time products, and the answr.id chatbot. Each
        product page describes what is included. Custom software projects may
        also be covered by a separate written agreement, which takes priority
        where it differs from these terms.
      </p>
    ),
  },
  {
    id: 'payment',
    title: 'Prices and payment',
    body: (
      <ul>
        <li>Prices are in Indonesian rupiah and shown before you pay.</li>
        <li>
          Subscriptions are paid in advance for a fixed period. They do not
          renew by themselves; you extend them by paying for another period.
        </li>
        <li>
          An invoice must be paid before it expires. A product is yours once its
          payment is confirmed.
        </li>
        <li>
          Payments are final unless the law says otherwise or we agree to a
          refund in writing.
        </li>
      </ul>
    ),
  },
  {
    id: 'expiry',
    title: 'When a subscription ends',
    body: (
      <p>
        When a subscription ends, the hosted service is turned off and its
        address goes offline. Your data is kept for a while so you can extend
        and turn it back on. If a subscription stays expired, we may delete the
        service&rsquo;s data after letting you know.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>You agree not to use our services to:</p>
        <ul>
          <li>break the law, or store or share unlawful content;</li>
          <li>send spam, malware or phishing;</li>
          <li>
            attack, overload or try to get unauthorised access to any system,
            including ours;
          </li>
          <li>infringe anyone&rsquo;s intellectual property or privacy.</li>
        </ul>
        <p>
          We may suspend a service that breaks these rules or puts other users
          at risk, and will tell you why when we can.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Your content',
    body: (
      <p>
        You keep ownership of the data you put into the services we host. You
        let us store, copy and process it only as needed to run the service for
        you. You are responsible for having the right to use that data and for
        keeping your own copies of anything important.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability',
    body: (
      <p>
        We work to keep services running and monitor them around the clock, but
        we cannot promise they will never be interrupted. Maintenance, updates
        and problems outside our control can cause downtime.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    body: (
      <p>
        To the extent the law allows, our services are provided &ldquo;as
        is&rdquo;, and {BRAND_NAME} is not liable for indirect losses such as
        lost profits or lost data. Our total liability for a claim is limited to
        what you paid us for the service concerned in the three months before
        the claim.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Closing your account',
    body: (
      <p>
        You can stop using our services at any time. We may close an account
        that seriously or repeatedly breaks these terms. Sections that by their
        nature should last, such as payment and liability, still apply
        afterwards.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of the Republic of Indonesia. We
        will first try to settle any dispute with you directly and in good
        faith.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    body: (
      <p>
        We may update these terms. When we do, we change the date above, and for
        significant changes we tell you in advance. Continuing to use our
        services after a change means you accept the new terms.
      </p>
    ),
  },
]

const SECTIONS_ID: LegalSection[] = [
  {
    id: 'your-account',
    title: 'Akun Anda',
    body: (
      <ul>
        <li>
          Anda harus memberikan alamat email yang valid dan menjaganya tetap
          mutakhir.
        </li>
        <li>
          Jaga kata sandi Anda. Anda bertanggung jawab atas semua yang terjadi
          di bawah akun Anda.
        </li>
        <li>
          Anda harus cukup umur untuk membuat perjanjian di tempat Anda tinggal,
          atau memiliki izin dari orang tua atau wali.
        </li>
      </ul>
    ),
  },
  {
    id: 'services',
    title: 'Layanan kami',
    body: (
      <p>
        {BRAND_NAME} menawarkan pekerjaan software khusus, aplikasi bisnis
        hosting yang dijual sebagai langganan, produk sekali beli, dan chatbot
        answr.id. Setiap halaman produk menjelaskan apa saja yang termasuk.
        Proyek software khusus juga dapat diatur dalam perjanjian tertulis
        terpisah, yang didahulukan jika berbeda dari ketentuan ini.
      </p>
    ),
  },
  {
    id: 'payment',
    title: 'Harga dan pembayaran',
    body: (
      <ul>
        <li>
          Harga dalam rupiah Indonesia dan ditampilkan sebelum Anda membayar.
        </li>
        <li>
          Langganan dibayar di muka untuk periode tertentu. Langganan tidak
          diperpanjang otomatis; Anda memperpanjangnya dengan membayar periode
          berikutnya.
        </li>
        <li>
          Invoice harus dibayar sebelum kedaluwarsa. Produk menjadi milik Anda
          setelah pembayarannya terkonfirmasi.
        </li>
        <li>
          Pembayaran bersifat final kecuali hukum menentukan lain atau kami
          menyetujui pengembalian dana secara tertulis.
        </li>
      </ul>
    ),
  },
  {
    id: 'expiry',
    title: 'Ketika langganan berakhir',
    body: (
      <p>
        Ketika langganan berakhir, layanan hosting dimatikan dan alamatnya tidak
        lagi bisa diakses. Data Anda disimpan beberapa waktu agar Anda bisa
        memperpanjang dan menyalakannya kembali. Jika langganan tetap
        kedaluwarsa, kami dapat menghapus data layanan tersebut setelah memberi
        tahu Anda.
      </p>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Penggunaan yang diperbolehkan',
    body: (
      <>
        <p>Anda setuju untuk tidak menggunakan layanan kami untuk:</p>
        <ul>
          <li>
            melanggar hukum, atau menyimpan atau membagikan konten ilegal;
          </li>
          <li>mengirim spam, malware, atau phishing;</li>
          <li>
            menyerang, membebani, atau mencoba mengakses sistem apa pun tanpa
            izin, termasuk sistem kami;
          </li>
          <li>melanggar kekayaan intelektual atau privasi orang lain.</li>
        </ul>
        <p>
          Kami dapat menangguhkan layanan yang melanggar aturan ini atau
          membahayakan pengguna lain, dan akan menjelaskan alasannya jika
          memungkinkan.
        </p>
      </>
    ),
  },
  {
    id: 'your-content',
    title: 'Konten Anda',
    body: (
      <p>
        Anda tetap memiliki data yang Anda masukkan ke layanan yang kami
        hosting. Anda mengizinkan kami menyimpan, menyalin, dan memprosesnya
        hanya sebatas yang diperlukan untuk menjalankan layanan bagi Anda. Anda
        bertanggung jawab memastikan Anda berhak menggunakan data tersebut dan
        menyimpan salinan sendiri dari hal-hal yang penting.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Ketersediaan',
    body: (
      <p>
        Kami berupaya menjaga layanan tetap berjalan dan memantaunya sepanjang
        waktu, tetapi kami tidak dapat menjanjikan layanan tidak akan pernah
        terganggu. Pemeliharaan, pembaruan, dan masalah di luar kendali kami
        dapat menyebabkan downtime.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Tanggung jawab',
    body: (
      <p>
        Sejauh diizinkan hukum, layanan kami diberikan &ldquo;apa adanya&rdquo;,
        dan {BRAND_NAME} tidak bertanggung jawab atas kerugian tidak langsung
        seperti hilangnya keuntungan atau data. Tanggung jawab total kami atas
        suatu klaim dibatasi pada jumlah yang Anda bayarkan kepada kami untuk
        layanan terkait dalam tiga bulan sebelum klaim diajukan.
      </p>
    ),
  },
  {
    id: 'ending',
    title: 'Menutup akun Anda',
    body: (
      <p>
        Anda dapat berhenti menggunakan layanan kami kapan saja. Kami dapat
        menutup akun yang melanggar ketentuan ini secara serius atau berulang.
        Bagian-bagian yang sifatnya harus tetap berlaku, seperti pembayaran dan
        tanggung jawab, tetap berlaku setelahnya.
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Hukum yang berlaku',
    body: (
      <p>
        Ketentuan ini tunduk pada hukum Republik Indonesia. Kami akan terlebih
        dahulu berusaha menyelesaikan setiap perselisihan dengan Anda secara
        langsung dan dengan itikad baik.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Perubahan pada ketentuan ini',
    body: (
      <p>
        Kami dapat memperbarui ketentuan ini. Jika itu terjadi, kami mengubah
        tanggal di atas, dan untuk perubahan penting kami memberi tahu Anda
        sebelumnya. Dengan terus menggunakan layanan kami setelah perubahan,
        Anda menerima ketentuan yang baru.
      </p>
    ),
  },
]

export default function TermsOfService() {
  const isId = getLocale() === 'id'
  return (
    <LegalPage
      eyebrow={m.legal_eyebrow()}
      title={m.nav_terms()}
      updated={TERMS_UPDATED}
      intro={
        isId ? (
          <p>
            Ketentuan ini berlaku saat Anda membuat akun di {BRAND_NAME},
            membeli produk kami, atau menggunakan layanan yang kami hosting.
            Cara kami menangani data pribadi dijelaskan dalam{' '}
            <Link to="/privacy" className="text-[var(--ink)] underline">
              kebijakan privasi
            </Link>{' '}
            kami.
          </p>
        ) : (
          <p>
            These terms apply when you create an account with {BRAND_NAME}, buy
            one of our products or use a service we host. How we handle personal
            data is described in our{' '}
            <Link to="/privacy" className="text-[var(--ink)] underline">
              privacy policy
            </Link>
            .
          </p>
        )
      }
      sections={isId ? SECTIONS_ID : SECTIONS_EN}
    />
  )
}
