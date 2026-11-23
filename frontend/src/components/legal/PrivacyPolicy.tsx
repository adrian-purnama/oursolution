import { Link } from '@tanstack/react-router'
import LegalPage from '#/components/legal/LegalPage'
import type { LegalSection } from '#/components/legal/LegalPage'
import { BRAND_NAME } from '#/lib/config'
import { m } from '#/paraglide/messages'
import { getLocale } from '#/paraglide/runtime'

export const PRIVACY_UPDATED = '16 November 2026'

const SECTIONS_EN: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'What we collect',
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your email address and a securely
          hashed password. If you sign in with Google, we receive your email
          address and basic profile from Google.
        </li>
        <li>
          <strong>Orders and billing:</strong> the products you buy, invoices,
          amounts and payment status. Card and bank details are entered with our
          payment provider; we never see or store them.
        </li>
        <li>
          <strong>Support:</strong> the tickets and messages you send us, and
          any files you attach.
        </li>
        <li>
          <strong>Hosted services:</strong> the settings you enter for a
          service, and the data you or your users store in it while we host it.
        </li>
        <li>
          <strong>Technical data:</strong> logs such as IP address, browser and
          request times, and uptime checks of the services we host for you.
        </li>
      </ul>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'How we use it',
    body: (
      <ul>
        <li>To create and secure your account and sign you in.</li>
        <li>To deliver, deploy, monitor and support the services you buy.</li>
        <li>
          To bill you, send invoices and remind you before a subscription ends.
        </li>
        <li>To answer support tickets and keep you informed about them.</li>
        <li>To prevent abuse and fraud, and to meet our legal obligations.</li>
      </ul>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Who we share it with',
    body: (
      <>
        <p>
          We do not sell your personal data. We share only what is needed with
          providers that help us run {BRAND_NAME}:
        </p>
        <ul>
          <li>Our payment provider, to take payments.</li>
          <li>Google, when you choose to sign in with Google.</li>
          <li>
            Our email provider, to send codes, invoices and notifications.
          </li>
          <li>
            Network and hosting providers that carry traffic to the services we
            host.
          </li>
          <li>
            An AI provider that helps us summarise support tickets so we can
            answer faster.
          </li>
        </ul>
        <p>
          We may also disclose data when the law requires it, or to protect the
          rights and safety of our users and of {BRAND_NAME}.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies and local storage',
    body: (
      <p>
        We use your browser&rsquo;s storage to keep you signed in and to
        remember small preferences, such as a notice you dismissed. We do not
        use advertising cookies.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    body: (
      <p>
        We keep account data while your account is open. Billing records are
        kept as long as tax and accounting law requires. When a subscription
        ends, the service is turned off but its data is kept for a while so you
        can extend; we may delete it after letting you know. Support tickets are
        kept so we can refer back to them.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Security',
    body: (
      <p>
        Passwords are hashed, traffic is encrypted in transit, and access to our
        systems is limited to the people who need it. No system is perfectly
        secure; if a breach affects your data, we will tell you as the law
        requires.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your rights',
    body: (
      <p>
        Under Indonesia&rsquo;s Personal Data Protection Law (UU No. 27 Tahun
        2022) and other laws that apply to you, you can ask to see, correct or
        delete your personal data, ask for a copy of it, or withdraw consent you
        gave. Some data, such as billing records, we may have to keep. To make a
        request, contact us.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: (
      <p>
        If we change this policy in a way that matters, we will update the date
        above and, for significant changes, tell you by email or in your
        dashboard.
      </p>
    ),
  },
]

const SECTIONS_ID: LegalSection[] = [
  {
    id: 'what-we-collect',
    title: 'Data yang kami kumpulkan',
    body: (
      <ul>
        <li>
          <strong>Data akun:</strong> alamat email Anda dan kata sandi yang
          disimpan dalam bentuk hash. Jika Anda masuk dengan Google, kami
          menerima alamat email dan profil dasar Anda dari Google.
        </li>
        <li>
          <strong>Pesanan dan tagihan:</strong> produk yang Anda beli, invoice,
          jumlah, dan status pembayaran. Data kartu dan rekening diisi langsung
          di penyedia pembayaran kami; kami tidak pernah melihat atau
          menyimpannya.
        </li>
        <li>
          <strong>Dukungan:</strong> tiket dan pesan yang Anda kirim kepada
          kami, serta berkas yang Anda lampirkan.
        </li>
        <li>
          <strong>Layanan hosting:</strong> pengaturan yang Anda isi untuk
          sebuah layanan, dan data yang Anda atau pengguna Anda simpan di
          dalamnya selama kami meng-hosting-nya.
        </li>
        <li>
          <strong>Data teknis:</strong> log seperti alamat IP, browser, dan
          waktu permintaan, serta pengecekan uptime layanan yang kami hosting
          untuk Anda.
        </li>
      </ul>
    ),
  },
  {
    id: 'how-we-use-it',
    title: 'Cara kami menggunakannya',
    body: (
      <ul>
        <li>Untuk membuat dan mengamankan akun Anda serta memasukkan Anda.</li>
        <li>
          Untuk mengirimkan, men-deploy, memantau, dan mendukung layanan yang
          Anda beli.
        </li>
        <li>
          Untuk menagih Anda, mengirim invoice, dan mengingatkan Anda sebelum
          langganan berakhir.
        </li>
        <li>
          Untuk menjawab tiket dukungan dan memberi Anda kabar tentangnya.
        </li>
        <li>
          Untuk mencegah penyalahgunaan dan penipuan, serta memenuhi kewajiban
          hukum kami.
        </li>
      </ul>
    ),
  },
  {
    id: 'who-we-share-with',
    title: 'Dengan siapa kami membagikannya',
    body: (
      <>
        <p>
          Kami tidak menjual data pribadi Anda. Kami hanya membagikan yang
          diperlukan kepada penyedia yang membantu kami menjalankan {BRAND_NAME}
          :
        </p>
        <ul>
          <li>Penyedia pembayaran kami, untuk memproses pembayaran.</li>
          <li>Google, ketika Anda memilih masuk dengan Google.</li>
          <li>
            Penyedia email kami, untuk mengirim kode, invoice, dan notifikasi.
          </li>
          <li>
            Penyedia jaringan dan hosting yang membawa lalu lintas ke layanan
            yang kami hosting.
          </li>
          <li>
            Penyedia AI yang membantu kami merangkum tiket dukungan agar kami
            bisa menjawab lebih cepat.
          </li>
        </ul>
        <p>
          Kami juga dapat mengungkapkan data jika diwajibkan oleh hukum, atau
          untuk melindungi hak dan keselamatan pengguna kami serta {BRAND_NAME}.
        </p>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookie dan penyimpanan lokal',
    body: (
      <p>
        Kami memakai penyimpanan browser Anda agar Anda tetap masuk dan untuk
        mengingat preferensi kecil, seperti pemberitahuan yang Anda tutup. Kami
        tidak memakai cookie iklan.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'Berapa lama kami menyimpannya',
    body: (
      <p>
        Kami menyimpan data akun selama akun Anda aktif. Catatan tagihan
        disimpan selama yang diwajibkan oleh hukum pajak dan akuntansi. Ketika
        langganan berakhir, layanan dimatikan tetapi datanya disimpan beberapa
        waktu agar Anda bisa memperpanjang; kami dapat menghapusnya setelah
        memberi tahu Anda. Tiket dukungan disimpan agar kami bisa merujuknya
        kembali.
      </p>
    ),
  },
  {
    id: 'security',
    title: 'Keamanan',
    body: (
      <p>
        Kata sandi di-hash, lalu lintas dienkripsi saat dikirim, dan akses ke
        sistem kami dibatasi hanya untuk orang yang membutuhkannya. Tidak ada
        sistem yang sepenuhnya aman; jika terjadi pelanggaran yang menyangkut
        data Anda, kami akan memberi tahu Anda sesuai ketentuan hukum.
      </p>
    ),
  },
  {
    id: 'your-rights',
    title: 'Hak Anda',
    body: (
      <p>
        Berdasarkan Undang-Undang Pelindungan Data Pribadi Indonesia (UU No. 27
        Tahun 2022) dan hukum lain yang berlaku bagi Anda, Anda dapat meminta
        untuk melihat, memperbaiki, atau menghapus data pribadi Anda, meminta
        salinannya, atau menarik persetujuan yang pernah Anda berikan. Sebagian
        data, seperti catatan tagihan, mungkin wajib kami simpan. Untuk
        mengajukan permintaan, silakan hubungi kami.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Perubahan pada kebijakan ini',
    body: (
      <p>
        Jika kami mengubah kebijakan ini dengan cara yang berarti, kami akan
        memperbarui tanggal di atas dan, untuk perubahan penting, memberi tahu
        Anda lewat email atau di dashboard Anda.
      </p>
    ),
  },
]

export default function PrivacyPolicy() {
  const isId = getLocale() === 'id'
  return (
    <LegalPage
      eyebrow={m.legal_eyebrow()}
      title={m.nav_privacy()}
      updated={PRIVACY_UPDATED}
      intro={
        isId ? (
          <p>
            Kebijakan ini menjelaskan data pribadi apa yang dikumpulkan{' '}
            {BRAND_NAME} saat Anda memakai website kami, membeli produk kami,
            atau menggunakan layanan yang kami hosting, dan apa yang kami
            lakukan dengannya. Kebijakan ini berjalan bersama{' '}
            <Link to="/terms" className="text-[var(--ink)] underline">
              ketentuan layanan
            </Link>{' '}
            kami.
          </p>
        ) : (
          <p>
            This policy explains what personal data {BRAND_NAME} collects when
            you use our website, buy our products or use the services we host,
            and what we do with it. It goes together with our{' '}
            <Link to="/terms" className="text-[var(--ink)] underline">
              terms of service
            </Link>
            .
          </p>
        )
      }
      sections={isId ? SECTIONS_ID : SECTIONS_EN}
    />
  )
}
