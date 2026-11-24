import type {Metadata, Viewport} from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--nf-display', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], variable: '--nf-sans', display: 'swap' });

export const metadata: Metadata = {
  title: 'LlamaGO - Mototaxis a un toque',
  description: 'LlamaGO es una plataforma moderna de movilidad urbana para solicitar mototaxis en Riberalta de forma rápida y segura.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LlamaGO',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon-192.png?v=4.0', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png?v=4.0', sizes: '512x512', type: 'image/png' },
      { url: '/logo.png?v=4.0', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png?v=4.0', sizes: '180x180', type: 'image/png' },
      { url: '/icon-192.png?v=4.0' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#05080B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json?v=4.0" />
        <meta name="theme-color" content="#05080B" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LlamaGO" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=4.0" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png?v=4.0" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png?v=4.0" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico?v=4.0" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.deferredPwaPrompt = null;
              window.addEventListener('beforeinstallprompt', (e) => {
                // Sin preventDefault: Chrome muestra su propio aviso nativo de instalación.
                window.deferredPwaPrompt = e;
              });
            `,
          }}
        />
      </head>
      <body className={`font-sans antialiased bg-background text-white select-none overflow-hidden h-screen h-[100dvh]`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
