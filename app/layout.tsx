import './globals.css';
import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import Sidebar from '@/components/Sidebar';
import QueryProvider from '@/components/QueryProvider';
import TopBar from '@/components/TopBar';
import { MobileNavProvider } from '@/components/MobileNavContext';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Pokéfolio — TCG Portfolio',
  description:
    'A self-hosted Pokémon TCG portfolio: collection, binders, wishlist, prices. Powered by TCGdex with custom-card support.',
  applicationName: 'Pokéfolio',
  appleWebApp: {
    capable: true,
    title: 'Pokéfolio',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  themeColor: '#06070d',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${display.variable}`}>
      <body className="min-h-screen font-sans">
        <QueryProvider>
          <MobileNavProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 flex flex-col min-w-0">
                <TopBar />
                <main className="flex-1 px-4 sm:px-6 lg:px-10 py-5 sm:py-8 max-w-[1500px] w-full mx-auto">
                  {children}
                </main>
              </div>
            </div>
          </MobileNavProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
