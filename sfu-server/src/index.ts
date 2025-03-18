import { Server, Socket } from "socket.io";
import { createServer } from "http";
import * as wrtc from "@roamhq/wrtc";
import {
  ClientEnterBody,
  ClientJoinBody,
  ClientPeerData,
  GetReceiverCandidateBody,
  GetSenderCandidateBody,
  ReceiverCandidateResponse,
  ReceiverOfferBody,
  RoomState,
  SenderCandidateResponse,
  SenderOfferData,
} from "./types/socket";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// const CLIENT_ROOM = "client-room";
const ADMIN_ROOM = "admin-room";

enum SOCKET_ON_ENUM {
  JOIN_CLIENT = "join-client",
  JOIN_ADMIN = "join-admin",
  SENDER_OFFER = "sender-offer",
  SENDER_CANDIDATE = "sender-candidate",
  RECEIVER_OFFER = "receiver-offer",
  RECEIVER_CANDIDATE = "receiver-candidate",
  DISCONNECT = "disconnect",
}

enum SOCKET_EMIT_ENUM {
  GET_SENDER_CANDIDATE = "get-sender-candidate",
  GET_SENDER_ANSWER = "get-sender-answer",
  CLIENT_ENTER = "client-enter",
  GET_RECEIVER_CANDIDATE = "get-receiver-candidate",
  GET_RECEIVER_ANSWER = "get-receiver-answer",
  CLIENT_LIST = "client-list",
  ERROR = "error",
}

const PC_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

const roomState: RoomState = {
  clients: {},
  senderPC: {},
  receiverPC: {},
};

const createReceiverPeerConnection = (socketID: string, socket: Socket) => {
  const pc = new wrtc.RTCPeerConnection(PC_CONFIG);
  roomState.receiverPC[socketID] = pc;

  pc.onicecandidate = (e) => {
    console.log(`socketID: ${socketID}'s receiverPeerConnection icecandidate`);
    const candidateBody: GetSenderCandidateBody = {
      candidate: e.candidate,
    };
    socket
      .to(socketID)
      .emit(SOCKET_EMIT_ENUM.GET_SENDER_CANDIDATE, candidateBody);
  };

  pc.oniceconnectionstatechange = (e) => {
    console.log(e);
  };

  pc.ontrack = (e) => {
    socket.broadcast
      .to(ADMIN_ROOM)
      .emit(SOCKET_EMIT_ENUM.CLIENT_ENTER, { id: socketID } as ClientEnterBody);
    roomState.clients[socketID].stream = [...e.streams];
  };

  return pc;
};

const createSenderPeerConnection = (
  receiverSocketID: string,
  senderSocketID: string,
  socket: Socket,
) => {
  const pc = new wrtc.RTCPeerConnection(PC_CONFIG);
  roomState.senderPC[senderSocketID] = pc;

  pc.onicecandidate = (e) => {
    console.log(
      `socketID: ${receiverSocketID}'s senderPeerConnection icecandidate`,
    );
    const getReceiverCandidateBody: GetReceiverCandidateBody = {
      id: senderSocketID,
      candidate: e.candidate,
    };
    socket
      .to(receiverSocketID)
      .emit(SOCKET_EMIT_ENUM.GET_RECEIVER_CANDIDATE, getReceiverCandidateBody);
  };

  pc.oniceconnectionstatechange = (e) => {
    console.log(e);
  };

  const currentStream = roomState.clients[senderSocketID].stream[0];
  currentStream.getTracks().forEach((track) => {
    pc.addTrack(track, currentStream);
  });

  return pc;
};

/**
 * Handle socket connections and events
 */
io.on("connection", (socket) => {
  /**
   * Client joins a specific room
   * @param {string} room - Room identifier
   */
  socket.on(SOCKET_ON_ENUM.JOIN_CLIENT, (data: ClientJoinBody) => {
    try {
      const newClient: ClientPeerData = {
        id: data.id,
        stream: [],
      };
      roomState.clients[data.id] = newClient;
      //   io.to("admin").emit(SOCKET_EMIT_ENUM.CLIENT_JOINED, {
      //     room: MAIN_ROOM,
      //   });
    } catch (error) {
      socket.emit(SOCKET_EMIT_ENUM.ERROR, {
        message: `Failed to join room: ${error}`,
      });
    }
  });

  socket.on(SOCKET_ON_ENUM.SENDER_OFFER, async (data: SenderOfferData) => {
    try {
      let pc = createReceiverPeerConnection(data.senderSocketId, socket);
      await pc.setRemoteDescription(data.sdp);
      let sdp = await pc.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(sdp);
      io.to(data.senderSocketId).emit(SOCKET_EMIT_ENUM.GET_SENDER_ANSWER, {
        sdp,
      });
    } catch (error) {
      socket.emit(SOCKET_EMIT_ENUM.ERROR, {
        message: `Failed to handle ${SOCKET_ON_ENUM.SENDER_OFFER}: ${error}`,
      });
    }
  });

  socket.on(
    SOCKET_ON_ENUM.SENDER_CANDIDATE,
    async (data: SenderCandidateResponse) => {
      try {
        let pc = roomState.receiverPC[data.senderSocketId];
        await pc.addIceCandidate(new wrtc.RTCIceCandidate(data.candidate));
      } catch (error) {
        socket.emit(SOCKET_EMIT_ENUM.ERROR, {
          message: `Failed to handle ${SOCKET_ON_ENUM.SENDER_CANDIDATE}: ${error}`,
        });
      }
    },
  );

  /**
   * Admin joins the admin room and receives room status
   */
  socket.on(SOCKET_ON_ENUM.JOIN_ADMIN, () => {
    try {
      socket.join(ADMIN_ROOM);
      const clientIds = Object.keys(roomState.clients);

      socket.emit(SOCKET_EMIT_ENUM.CLIENT_LIST, { clientIds: clientIds });
    } catch (error) {
      socket.emit(SOCKET_EMIT_ENUM.ERROR, {
        message: `Failed to handle ${SOCKET_ON_ENUM.JOIN_ADMIN}: ${error}`,
      });
    }
  });

  socket.on(SOCKET_ON_ENUM.RECEIVER_OFFER, async (data: ReceiverOfferBody) => {
    try {
      let pc = createSenderPeerConnection(
        data.adminSocketId,
        data.selectedClientSocketId,
        socket,
      );
      await pc.setRemoteDescription(data.sdp);
      let sdp = await pc.createAnswer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(sdp);
      io.to(data.adminSocketId).emit(SOCKET_EMIT_ENUM.GET_RECEIVER_ANSWER, {
        id: data.selectedClientSocketId,
        sdp,
      });
    } catch (error) {
      socket.emit(SOCKET_EMIT_ENUM.ERROR, {
        message: `Failed to handle ${SOCKET_ON_ENUM.RECEIVER_OFFER}: ${error}`,
      });
    }
  });

  socket.on(
    SOCKET_ON_ENUM.RECEIVER_CANDIDATE,
    async (data: ReceiverCandidateResponse) => {
      try {
        await roomState.senderPC[data.selectedClientSocketId].addIceCandidate(
          new wrtc.RTCIceCandidate(data.candidate),
        );
      } catch (error) {
        socket.emit(SOCKET_EMIT_ENUM.ERROR, {
          message: `Failed to handle ${SOCKET_ON_ENUM.RECEIVER_CANDIDATE}: ${error}`,
        });
      }
    },
  );

  /**
   * Handle client disconnection and notify admin
   */
  socket.on(SOCKET_ON_ENUM.DISCONNECT, () => {
    delete roomState.clients[socket.id];
    if (roomState.receiverPC[socket.id]) {
      roomState.receiverPC[socket.id].close();
      delete roomState.receiverPC[socket.id];
    }

    if (roomState.senderPC[socket.id]) {
      roomState.senderPC[socket.id].close();
      delete roomState.senderPC[socket.id];
    }
  });
});

const PORT = 8080;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server is running on port ${PORT}`);
});
