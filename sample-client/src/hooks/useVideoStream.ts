import { useEffect, useMemo, useState } from "react";

type UseVideoStreamProps = {
  streamServerUrl: string;
  suuid: string;
  isStreamServerInSameNetwork: boolean;
};

const useVideoStream = ({
  streamServerUrl,
  suuid,
  isStreamServerInSameNetwork,
}: UseVideoStreamProps) => {
  const [isOnline, setIsOnline] = useState<boolean>(false);
  // const stream = useMemo(() => new MediaStream(), []);
  const [stream, setStream] = useState<MediaStream | undefined>(undefined);
  const [connection, setConnection] = useState<RTCPeerConnection | undefined>(
    undefined
  );
  const config = isStreamServerInSameNetwork
    ? {}
    : {
        iceServers: [
          {
            urls: ["stun:stun.l.google.com:19302"],
          },
        ],
      };

  useEffect(() => {
    if (typeof window !== "undefined") {
      setStream(new MediaStream());
      setConnection(new RTCPeerConnection(config));
    }
  }, []);

  // Config will be re-created every time the component re-renders,
  // so we will not include it in the dependency array
  // const connection = useMemo(() => new RTCPeerConnection(config), []);

  useEffect(() => {
    const log = (msg: string) => {
      console.log("Log from useVideoStream hook: ", msg);
    };
    if (connection) {
      const handleNegotiationNeededEvent = async () => {
        try {
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          getRemoteSdp();
        } catch (error) {
          console.error("Error during negotiation:", error);
          setIsOnline(false);
        }
      };

      const getCodecInfo = async () => {
        try {
          const response = await fetch(
            `${streamServerUrl}/stream/codec/${suuid}`
          );
          const data = await response.json();
          // data should be an array of codec objects
          data.forEach((value: { Type: string }) => {
            connection.addTransceiver(value.Type, {
              direction: "sendrecv",
            });
          });
        } catch (error) {
          console.error("Failed to get codec info:", error);
          setIsOnline(false);
        }
      };

      const getRemoteSdp = async () => {
        if (!connection.localDescription) return;

        try {
          const response = await fetch(
            `${streamServerUrl}/stream/receiver/${suuid}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: `suuid=${encodeURIComponent(
                suuid
              )}&data=${encodeURIComponent(
                btoa(connection.localDescription.sdp)
              )}`,
            }
          );
          const data = await response.text();
          connection.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: atob(data),
            })
          );
          setIsOnline(true);
        } catch (error) {
          console.warn("Failed to set remote description:", error);
          setIsOnline(false);
        }
      };

      // Kick off the process
      getCodecInfo();

      connection.onnegotiationneeded = handleNegotiationNeededEvent;

      connection.ontrack = (event) => {
        if (stream) {
          stream.addTrack(event.track);
          log(event.streams.length + " track is delivered");
        }
      };

      connection.oniceconnectionstatechange = () => {
        log(connection.iceConnectionState);
        if (
          connection.iceConnectionState === "failed" ||
          connection.iceConnectionState === "disconnected"
        ) {
          setIsOnline(false);
        }
      };

      // Cleanup when unmounting
      return () => {
        connection.close();
      };
    }
  }, [suuid, stream, streamServerUrl]);

  return { stream, connection, isOnline };
};

export default useVideoStream;
