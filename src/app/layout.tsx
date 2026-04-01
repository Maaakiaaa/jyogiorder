import "../styles/globals.css";
import Image from "next/image";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
          <Image
            src="/jyogi.png"
            alt=""
            width={280}
            height={280}
            priority
            className="h-56 w-56 opacity-[0.07] sm:h-72 sm:w-72"
          />
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
