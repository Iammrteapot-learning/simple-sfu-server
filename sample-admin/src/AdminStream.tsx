import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_EMIT_ENUM, SOCKET_ON_ENUM } from "./SocketEnum";
import AdminMainVideo from "./AdminMainVideo";

export default function AdminStream() {
  const SFU_SERVER_URL = "http://172.20.10.2:8080";
  const socketRef = useRef<Socket | null>(null);
  const [clientIds, setClientIds] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const handleSelectClient = (id: string) => {
    setSelectedClientId(id);
  };

  useEffect(() => {
    socketRef.current = io(SFU_SERVER_URL);
    while (!socketRef.current) {
      console.log("Not Ready");
    }
    socketRef.current.on(
      SOCKET_ON_ENUM.CLIENT_LIST,
      (data: { clientIds: string[] }) => {
        setClientIds([...data.clientIds]);
      }
    );

    socketRef.current.on(
      SOCKET_ON_ENUM.CLIENT_ENTER,
      (data: { id: string }) => {
        setClientIds((prev) => [...prev, data.id]);
      }
    );

    socketRef.current.on("disconnect", () => {});

    console.log("before create sender peer");
    console.log(`Thumbnail Socket => ${socketRef.current.id}`);
    socketRef.current.emit(SOCKET_EMIT_ENUM.JOIN_ADMIN, {});

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off();
      }
    };
  }, [SFU_SERVER_URL]);

  useEffect(() => {
    if (socketRef.current) {
      console.log("socket id is ", socketRef.current.id);
      if (socketRef.current.id) {
        setIsReady(true);
      } else {
        setIsReady(false);
      }
    }
  }, [socketRef.current?.id]);

  return (
    <div>
      <h1>Admin Stream</h1>
      {clientIds.map((id) => (
        <button key={id} onClick={() => handleSelectClient(id)}>
          {id}
        </button>
      ))}
      {isReady && socketRef.current && (
        <AdminMainVideo
          clientId={selectedClientId || "no-client-found"}
          socketRef={socketRef}
        />
      )}
    </div>
  );
}
