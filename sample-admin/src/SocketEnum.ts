export enum SOCKET_EMIT_ENUM {
  JOIN_CLIENT = "join-client",
  JOIN_ADMIN = "join-admin",
  SENDER_OFFER = "sender-offer",
  SENDER_CANDIDATE = "sender-candidate",
  RECEIVER_OFFER = "receiver-offer",
  RECEIVER_CANDIDATE = "receiver-candidate",
  DISCONNECT = "disconnect",
}

export enum SOCKET_ON_ENUM {
  GET_SENDER_CANDIDATE = "get-sender-candidate",
  GET_SENDER_ANSWER = "get-sender-answer",
  CLIENT_ENTER = "client-enter",
  GET_RECEIVER_CANDIDATE = "get-receiver-candidate",
  GET_RECEIVER_ANSWER = "get-receiver-answer",
  CLIENT_LIST = "client-list",
  ERROR = "error",
}
