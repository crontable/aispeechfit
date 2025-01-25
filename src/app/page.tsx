import { ContentArea } from '@/components/ContentArea';
import { Sidebar } from '@/components/Sidebar';

export default function Home() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <ContentArea />
    </div>
  );
}
