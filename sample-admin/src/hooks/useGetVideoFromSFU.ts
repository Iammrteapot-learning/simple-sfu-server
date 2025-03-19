import { Socket } from "socket.io-client";
import { SOCKET_EMIT_ENUM, SOCKET_ON_ENUM } from "../SocketEnum";
import { useEffect } from "react";

export interface UseGetVideoFromSFUType {
  socketRef: React.RefObject<Socket | null>;
  pcRef: React.RefObject<RTCPeerConnection | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  clientId: string;
}

export default function useGetVideoFromSFU(props: UseGetVideoFromSFUType) {
  const { socketRef, pcRef, videoRef, clientId } = props;

  const PC_CONFIG = {
    iceServers: [
      {
        urls: ["stun:stun.l.google.com:19302"],
      },
    ],
  };
  const createReceiverPeerConnection = () => {
    const pc = new RTCPeerConnection(PC_CONFIG);
    console.log("create receiver peer connection !!!");
    console.log(pc);

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        console.log("no candidate");
        return;
      }
      if (!socketRef.current) {
        console.log("no socket found");
        return;
      }
      console.log("receiver thumbnail PC onicecandidate");
      socketRef.current.emit(SOCKET_EMIT_ENUM.RECEIVER_CANDIDATE, {
        candidate: e.candidate,
        selectedClientSocketId: clientId,
        adminSocketId: socketRef.current.id,
      });
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log(e);
    };

    pc.ontrack = (e) => {
      console.log("ontrack");
      if (videoRef.current) {
        console.log("ontrack video ref set");
        videoRef.current.srcObject = e.streams[0];
      }
    };

    pcRef.current = pc;
  };

  const createReceiverOffer = async (
    pc: RTCPeerConnection,
    selectedClientSocketId: string
  ) => {
    console.log("Create receiver offer run");
    try {
      const sdp = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await pc.setLocalDescription(new RTCSessionDescription(sdp));

      if (!socketRef.current) return;
      socketRef.current.emit(SOCKET_EMIT_ENUM.RECEIVER_OFFER, {
        sdp: sdp,
        adminSocketId: socketRef.current.id,
        selectedClientSocketId: selectedClientSocketId,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const registerSFU = async () => {
    try {
      if (!socketRef.current) {
        console.log("No socket found");
        return;
      }

      console.log("before create receiver peer");
      console.log(`Thumbnail Socket => ${socketRef.current.id}`);

      createReceiverPeerConnection();

      if (!pcRef.current) {
        console.log("No pc found");
        return;
      }
      await createReceiverOffer(pcRef.current, clientId);
    } catch (e) {
      console.log(`getLocalStream error: ${e}`);
    }
  };

  useEffect(() => {
    if (!socketRef.current || !videoRef.current) return;

    console.log("Main useEffect run socket id");
    console.log(socketRef.current.id);

    socketRef.current.on(
      SOCKET_ON_ENUM.GET_RECEIVER_ANSWER,
      async (data: { sdp: RTCSessionDescription; id: string }) => {
        try {
          if (!pcRef.current) {
            console.log("Receiver answer, No pc found");
            return;
          }
          console.log("Receiver answer, get receiver answer");
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
      SOCKET_ON_ENUM.GET_RECEIVER_CANDIDATE,
      async (data: { candidate: RTCIceCandidateInit; id: string }) => {
        console.log("Receiver candidate data, ", data);
        try {
          if (!data.candidate) {
            console.log("Receiver candidate, No candidate found");
            return;
          }

          if (!pcRef.current) {
            console.log("Receiver candidate, No pc found");
            return;
          }
          console.log("Receiver candidate, get receiver candidate");
          await pcRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("Receiver candidate, candidate add success");
        } catch (error) {
          console.log(error);
        }
      }
    );

    registerSFU();
    return () => {
      if (pcRef.current) {
        console.log("close pc");
        pcRef.current.close();
      }
    };
  }, [
    registerSFU,
    createReceiverOffer,
    createReceiverPeerConnection,
    socketRef,
    videoRef,
    pcRef,
  ]);
}
