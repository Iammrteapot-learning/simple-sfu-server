export interface RoomState {
  clients: Record<string, ClientPeerData>;
  senderPC: Record<string, RTCPeerConnection>;
  receiverPC: Record<string, RTCPeerConnection>;
}

export interface ClientPeerData {
  id: string;
  name?: string;
  stream: MediaStream[];
}

export interface GetSenderCandidateBody {
  candidate: RTCIceCandidate | null;
}

export interface ClientEnterBody {
  id: string;
}

export interface GetReceiverCandidateBody {
  id: string;
  candidate: RTCIceCandidate | null;
}

export interface ClientJoinBody {
  id: string;
}

export interface SenderOfferData {
  senderSocketId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface ReceiverOfferBody {
  adminSocketId: string;
  selectedClientSocketId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SenderCandidateResponse {
  senderSocketId: string;
  candidate: RTCIceCandidateInit;
}

export interface ReceiverCandidateResponse {
  candidate: RTCIceCandidateInit;
  selectedClientSocketId: string;
  adminSocketId: string;
}
