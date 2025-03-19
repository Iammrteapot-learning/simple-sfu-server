import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_EMIT_ENUM, SOCKET_ON_ENUM } from "./SocketEnum";
import useGetVideoFromSFU from "./hooks/useGetVideoFromSFU";

const PC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};

export default function AdminMainVideo({
  clientId,
  socketRef,
}: {
  clientId: string;
  socketRef: React.RefObject<Socket | null>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useGetVideoFromSFU({ socketRef, pcRef, videoRef, clientId });

  return (
    <div>
      <h1>Client ID: {clientId}</h1>
      <video ref={videoRef} id="admin-main-video" autoPlay muted></video>
    </div>
  );
}
