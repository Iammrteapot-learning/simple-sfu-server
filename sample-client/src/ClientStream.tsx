import { useCallback, useEffect, useRef } from "react";
import useVideoStream from "./hooks/useVideoStream";
import { io, Socket } from "socket.io-client";
import { SOCKET_ON_ENUM, SOCKET_EMIT_ENUM } from "./SocketEnum";
import useUploadToSFU from "./hooks/useUploadToSFU";

const PC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};

export default function ClientStream() {
  const SFU_SERVER_URL = "http://172.20.10.2:8080";
  const CONVERTER_SERVER_URL = "http://localhost:8083";
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const { stream, connection, isOnline } = useVideoStream({
    streamServerUrl: CONVERTER_SERVER_URL,
    suuid: "my_suuid",
    isStreamServerInSameNetwork: true,
  });

  useUploadToSFU({
    sfuServerUrl: SFU_SERVER_URL,
    socketRef: socketRef,
    pcRef: pcRef,
    stream: stream,
    isOnline: isOnline,
  });

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("video ref set");
      videoRef.current.srcObject = stream;
    }
  }, [stream, videoRef]);

  return (
    <div>
      <h1>Client Stream</h1>
      <video ref={videoRef} autoPlay muted></video>
    </div>
  );
}
