import type { Metadata } from "next";

import "./globals.css";


export const metadata: Metadata = {
    title: "CineMusic - Music meets Cinema",
    description: "Experience music with synchronized movie scenes.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="antialiased bg-white dark:bg-black text-gray-900 dark:text-gray-100">
                {children}
            </body>
        </html>
    );
}
