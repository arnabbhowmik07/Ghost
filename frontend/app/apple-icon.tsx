import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS / Safari home-screen icon - ink square, cream Ghost mark. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#252324",
        }}
      >
        <svg width="108" height="114" viewBox="0 0 19 20" fill="none">
          <path
            d="M2 9a7.5 7.5 0 0115 0v10.5l-2.5-2.2-2.5 2.2-2.5-2.2-2.5 2.2L4.5 17.3 2 19.5z"
            fill="#FEFBF6"
          />
          <rect x="6" y="7.5" width="2.4" height="4" rx="1.2" fill="#252324" />
          <rect
            x="10.6"
            y="7.5"
            width="2.4"
            height="4"
            rx="1.2"
            fill="#252324"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
