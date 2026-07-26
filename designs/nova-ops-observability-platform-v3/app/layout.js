import "./globals.css";

export const metadata = {
  title: "NOVA Ops · AI 可观测平台",
  description:
    "面向保障、变更、NL2巡检和故障调查的双 Agent AI 运维可观测平台高保真原型",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
