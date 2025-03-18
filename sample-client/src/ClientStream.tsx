import { useCallback, useEffect, useRef } from "react";
import useVideoStream from "./hooks/useVideoStream";
import { io, Socket } from "socket.io-client";

const PC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};

// const PC_CONFIG = {};

enum SOCKET_EMIT_ENUM {
  JOIN_CLIENT = "join-client",
  JOIN_ADMIN = "join-admin",
  SENDER_OFFER = "sender-offer",
  SENDER_CANDIDATE = "sender-candidate",
  RECEIVER_OFFER = "receiver-offer",
  RECEIVER_CANDIDATE = "receiver-candidate",
  DISCONNECT = "disconnect",
}

enum SOCKET_ON_ENUM {
  GET_SENDER_CANDIDATE = "get-sender-candidate",
  GET_SENDER_ANSWER = "get-sender-answer",
  CLIENT_ENTER = "client-enter",
  GET_RECEIVER_CANDIDATE = "get-receiver-candidate",
  GET_RECEIVER_ANSWER = "get-receiver-answer",
  CLIENT_LIST = "client-list",
  ERROR = "error",
}

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

  const registerSFU = async () => {
    try {
      while (!socketRef.current || socketRef.current.id === undefined) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
      }
      console.log("before create sender peer");
      console.log(`Thumbnail Socket => ${socketRef.current.id}`);

      socketRef.current.emit(SOCKET_EMIT_ENUM.JOIN_CLIENT, {
        id: socketRef.current.id,
      });
      createSenderPeerConnection();
      await createSenderOffer();
    } catch (e) {
      console.log(`getLocalStream error: ${e}`);
    }
  };

  const createSenderPeerConnection = () => {
    const pc = new RTCPeerConnection(PC_CONFIG);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        console.log("no candidate");
        return;
      }
      if (!socketRef.current) {
        console.log("no socket found");
        return;
      }
      console.log("sender thumbnail PC onicecandidate");
      socketRef.current.emit(SOCKET_EMIT_ENUM.SENDER_CANDIDATE, {
        candidate: e.candidate,
        senderSocketID: socketRef.current.id,
      });
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log(e);
    };

    if (stream) {
      console.log("adding local stream");
      stream.getTracks().forEach((track) => {
        if (!stream) return;
        pc.addTrack(track, stream);
      });
    } else {
      console.log("no local stream found");
    }

    pcRef.current = pc;
  };

  const createSenderOffer = async () => {
    console.log("Create sender offer run");
    try {
      if (!pcRef.current) return;
      const sdp = await pcRef.current.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });

      console.log("create sender offer success");

      await pcRef.current.setLocalDescription(new RTCSessionDescription(sdp));

      if (!socketRef.current) return;
      console.log(`Socket ID => ${socketRef.current.id}`);
      socketRef.current.emit(SOCKET_EMIT_ENUM.SENDER_OFFER, {
        sdp: sdp,
        senderSocketId: socketRef.current.id,
      });
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    socketRef.current = io(SFU_SERVER_URL);
    while (!socketRef.current) {
      console.log("Not Ready");
    }
    if (!stream || !isOnline) return;
    console.log("Main useEffect run");
    registerSFU();

    socketRef.current.on(
      SOCKET_ON_ENUM.GET_SENDER_ANSWER,
      async (data: { sdp: RTCSessionDescription }) => {
        try {
          if (!pcRef.current) return;
          console.log("get sender answer");
          console.log(data.sdp);
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
        } catch (error) {
          console.log(error);
        }
      }
    );

    socketRef.current.on(
      SOCKET_ON_ENUM.GET_SENDER_CANDIDATE,
      async (data: { candidate: RTCIceCandidateInit }) => {
        try {
          if (!(data.candidate && pcRef.current)) return;
          console.log("get sender candidate");
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("candidate add success");
        } catch (error) {
          console.log(error);
        }
      }
    );

    return () => {
      // Cleanup connections
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [
    registerSFU,
    createSenderOffer,
    createSenderPeerConnection,
    isOnline,
    stream,
    socketRef,
    pcRef,
    videoRef,
  ]);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("video ref set");
      videoRef.current.srcObject = stream;
    }
    console.log("stream", stream);
    console.log("stream tracks", stream?.getTracks());
  }, [stream, videoRef]);

  return (
    <div>
      <h1>Client Stream</h1>
      <video ref={videoRef} autoPlay></video>
    </div>
  );
}
