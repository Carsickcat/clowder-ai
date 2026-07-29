import "./globals.css";
import "./change-inspection.css";

export const metadata = {
  title: "NOVA · 变更巡检",
  description: "从变更前准入到灰度持续验证，再到变更后验收的完整巡检旅程",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
