import { useSelector } from "metabase/lib/redux";
import { getUser } from "metabase/selectors/user";

import S from "./UserWatermark.module.css";

function formatDateTime(): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = now.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} ${time}`;
}

export const UserWatermark = () => {
  const user = useSelector(getUser);

  if (!user) {
    return null;
  }

  const watermarkText = `${user.common_name} - ${formatDateTime()}`;

  return (
    <div className={S.Root} data-testid="user-watermark">
      <svg height="100%" width="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="user-watermark-text"
            x="0"
            y="0"
            height="350"
            width="350"
            patternUnits="userSpaceOnUse"
          >
            <text
              x="0"
              y="0"
              fontSize="70"
              fontWeight="700"
              transform="translate(35, 330) rotate(-45)"
              textAnchor="start"
              className={S.text}
            >
              {watermarkText}
            </text>
          </pattern>
        </defs>
        <rect
          opacity=".15"
          height="100%"
          width="100%"
          fill="url(#user-watermark-text)"
        />
      </svg>
    </div>
  );
};
