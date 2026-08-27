import { RoomChat } from "./RoomChat";

export const metadata = {
  title: "龍蝦房間 · 龍蝦社區",
};

export default function RoomDetailPage({ params }: { params: { id: string } }) {
  return <RoomChat roomId={params.id} />;
}
