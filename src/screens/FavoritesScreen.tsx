import { Top } from "@toss/tds-mobile";
import type { Pool } from "../supabase";
import PoolList from "../components/PoolList";
import { EmptyState } from "../design/primitives";
import { todayRowStatus } from "../lib/pools";

type Props = {
  pools: Pool[];
  favs: string[];
  onToggleFav: (id: string) => void;
  onSelect: (pool: Pool) => void;
};

export default function FavoritesScreen({ pools, favs, onToggleFav, onSelect }: Props) {
  const list = pools.filter((p) => favs.includes(p.id));

  return (
    <>
      <Top title={<Top.TitleParagraph size={28}>즐겨찾기</Top.TitleParagraph>} />
      {list.length ? (
        <PoolList pools={list} favs={favs} onToggleFav={onToggleFav} onSelect={onSelect} statusOf={todayRowStatus} />
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
