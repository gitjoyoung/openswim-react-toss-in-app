import favIcon from "../assets/icons/fav.webp";

// 즐겨찾기 별. 켜짐=컬러, 꺼짐=회색 처리(같은 3D 별 재사용).
export default function FavStar({ on, size = 24 }: { on: boolean; size?: number }) {
  return (
    <img
      src={favIcon}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
        // 꺼짐: 흰 배경에서도 보이는 또렷한 중간 회색
        filter: on ? "none" : "grayscale(1) brightness(0.82) opacity(0.9)",
      }}
    />
  );
}
