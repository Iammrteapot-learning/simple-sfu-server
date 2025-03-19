import { io, Socket } from "socket.io-client";
import { SOCKET_EMIT_ENUM, SOCKET_ON_ENUM } from "../SocketEnum";
import { useEffect } from "react";

export interface UseUploadToSFUType {
  sfuServerUrl: string;
  socketRef: React.RefObject<Socket | null>;
  pcRef: React.RefObject<RTCPeerConnection | null>;
  stream: MediaStream | undefined;
  isOnline: boolean;
}

const PC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"],
    },
  ],
};

const useUploadToSFU = (props: UseUploadToSFUType) => {
  const { sfuServerUrl, socketRef, pcRef, stream, isOnline } = props;
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
    socketRef.current = io(sfuServerUrl);
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
        socketRef.current.off();
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
  ]);
};

export default useUploadToSFU;
