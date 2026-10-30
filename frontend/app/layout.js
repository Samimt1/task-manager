import './globals.css';

export const metadata = { title: 'Task Manager', description: 'A focused workspace for your tasks.' };

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
