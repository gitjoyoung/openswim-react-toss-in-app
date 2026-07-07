-- 남은 자유수영 요금 보강 (자수맵/공개정보 교차확인)
update public.pools set price_free_swim=4000, prices=$j$[{"label": "1일권", "amount": 4000}]$j$::jsonb where name='서울장애인종합복지관 수중재활센터';
update public.pools set price_free_swim=4200, prices=$j$[{"label": "평일", "amount": 4200}, {"label": "주말", "amount": 5000}]$j$::jsonb where name='금천구민문화체육센터';
update public.pools set price_free_swim=3520, prices=$j$[{"label": "1일권", "amount": 3520}]$j$::jsonb where name='양주체육복지센터 실내수영장';
update public.pools set price_free_swim=3520, prices=$j$[{"label": "1일권", "amount": 3520}]$j$::jsonb where name='옥정호수스포츠센터 실내수영장';
