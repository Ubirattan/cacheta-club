import './globals.css';
import Tela from '../components/Tela.js';
export const metadata = { title: 'Cacheta Club', description: 'Cacheta online e contra o computador. Fichas virtuais, sem dinheiro de verdade.', manifest: '/manifest.webmanifest', icons: { icon: '/icon-192.png', apple: '/icon-192.png' }, appleWebApp: { capable: true, title: 'Cacheta Club', statusBarStyle: 'black-translucent' } };
export const viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, themeColor: '#1a1410' };
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Rubik:wght@400;500;700;800;900&family=Playfair+Display:ital,wght@1,800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('cc_four')==='1')document.body.classList.add('four')}catch(e){}" }} />
        {children}<div id="toast" /><Tela />
      </body>
    </html>
  );
}
