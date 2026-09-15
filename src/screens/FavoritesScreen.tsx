import { Top } from "@toss/tds-mobile";
import type { Pool } from "../pool";
import PoolList from "../components/PoolList";
import PoolListSkeleton from "../components/PoolListSkeleton";
import { EmptyState } from "../design/primitives";
import { todayRowStatus } from "../lib/pools";

type Props = {
  pools: Pool[];
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
  loading?: boolean;
};

export default function FavoritesScreen({
  pools,
  favs,
  onToggleFav,
  onSelect,
  loading = false,
}: Props) {
  const list = pools.filter((p) => favs.includes(p.id));

  return (
    <>
      <Top
        title={<Top.TitleParagraph size={28}>즐겨찾기</Top.TitleParagraph>}
      />
      {loading ? (
        <PoolListSkeleton />
      ) : list.length ? (
        <PoolList
          pools={list}
          favs={favs}
          onToggleFav={onToggleFav}
          onSelect={onSelect}
          statusOf={todayRowStatus}
        />
      ) : (
        <EmptyState
          emoji="⭐"
          text={
            <>
              아직 즐겨찾기가 없어요.
              <br />
              목록에서 ☆ 를 눌러 추가해 보세요.
            </>
          }
        />
      )}
    </>
  );
}
