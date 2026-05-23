// 코드 수정: window.onload를 하나로 합칩니다.
window.onload = function() {
  logVisitor();          // 방문자 기록 (추가된 기능)
  updateWeather();       // 날씨 업데이트
  loadHomeRanking();     // 랭킹 불러오기
  setTimeout(openNoticeModal, 500); // 공지사항
};

// logVisitor 함수는 그대로 유지
async function logVisitor() {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    await supabaseClient.from('visitor_logs').insert([{ ip: data.ip }]);
  } catch (err) {
    // 에러 발생 시 조용히 넘김
  }
}

const MEMBERS = ['윤민혁','고영지','김민수','송지용','양원준','지항민','김해건'];
    const TOTAL = 14, ADMIN_KEY = '0179', MASTER_KEY = '0179';
    const TARGET = { lat: 33.2549408014355, lng: 126.32857041329 };
    const supabaseClient = window.supabase.createClient("https://ndctjtuxpkwdldhqbnih.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kY3RqdHV4cGt3ZGxkaHFibmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTgwMjAsImV4cCI6MjA5MDk5NDAyMH0.SrHCtqlNE4cgepGMw_NoPC56bnJIfV2_t7Hbmj5EXCY");

    let locationOk = false, allNotices = [], currentPostId = null;

    window.onload = function() {
      updateWeather();
      loadHomeRanking(); 
      setTimeout(openNoticeModal, 500);
    };
        async function loadHomeRanking() {
      // name과 함께 created_at(날짜) 데이터도 최신순으로 정렬해서 가져옵니다.
      const { data } = await supabaseClient.from('attendance').select('name, created_at').order('created_at', { ascending: false });
      
      const countsRanking = {}; 
      const lastDateRanking = {};
      const allDatesRanking = {}; // 각 회원별 전체 출석일을 담을 배열
      const weeks = ['일', '월', '화', '수', '목', '금', '토'];
      
      MEMBERS.forEach(m => {
        countsRanking[m] = 0;
        lastDateRanking[m] = '-';
        allDatesRanking[m] = []; 
      });
      
      data?.forEach(r => { 
        if(countsRanking[r.name] !== undefined) {
          countsRanking[r.name]++;
          
          // 1. Supabase의 UTC 시각을 한국 시간(KST) 날짜 객체로 변환
          const kstDate = new Date(r.created_at);
          
          // 연, 월, 일, 시, 분 추출
          let month = String(kstDate.getMonth() + 1).padStart(2, '0');
          let day = String(kstDate.getDate()).padStart(2, '0');
          const hours = kstDate.getHours();
          const minutes = kstDate.getMinutes();
          
          let monthDay = `${month}-${day}`;
          let dayOfWeek = kstDate.getDay(); // 0: 일, 1: 월 ...

          // ★ [핵심 특수 조건] 송지용 5월 14일 데이터 강제 변환
          // DB에는 5월 14일로 들어있지만, 화면에는 5월 13일(수요일)로 강제 변경합니다.
          if (r.name === '송지용' && monthDay === '05-14') {
            monthDay = '05-13';
            dayOfWeek = 3; // 수요일로 강제 고정
          }
          
          const weekName = weeks[dayOfWeek]; 

          // 2. 출석 종류(접미사) 판별 로직
          let suffix = '';
          
          // [조건 1] 5월 15일은 전원 무조건 시티런
          if (monthDay === '05-15') {
            suffix = ' (시티런)';
          } 
          // [조건 2] 고영지 5월 13일은 무조건 대체런
          else if (r.name === '고영지' && monthDay === '05-13') {
            suffix = ' (대체런)';
          } 
          // [조건 3] 송지용 5월 8일과 (방금 바꾼) 5월 13일은 무조건 대체런
          else if (r.name === '송지용' && (monthDay === '05-08' || monthDay === '05-13')) {
            suffix = ' (대체런)';
          } 
          // [기본 규칙] 그 외에는 시간대로 판별 (20:02 ~ 21:00 정규 출석)
          else {
            const timeValue = hours * 60 + minutes; 
            const isRegularAttendance = (timeValue >= 1202 && timeValue <= 1260);
            suffix = isRegularAttendance ? '' : ' (대체런)';
          }
          
          const formattedDate = `${monthDay} (${weekName})${suffix}`;

          allDatesRanking[r.name].push(formattedDate);
          
          // ★ [최근 일자 반영 보정] 변환된 날짜를 기준으로 최근 출석일을 기록합니다.
          if(lastDateRanking[r.name] === '-') {
            lastDateRanking[r.name] = `${monthDay} ${weekName}`; 
          }
        }
      });
      
      window.currentAttendanceDates = allDatesRanking;

      const sorted = MEMBERS.map(n => {
        const count = countsRanking[n];
        const rate = Math.round(count / TOTAL * 100);
        const lastDate = lastDateRanking[n];
        return { name: n, count, rate, lastDate };
      }).sort((a,b) => b.count - a.count);
      
      document.getElementById('homeRankingList').innerHTML = sorted.map((m, i) => {
        const isPenalty = m.rate < 40;
        const penaltyClass = isPenalty ? 'penalty-row' : '';
        const rankClass = i < 3 ? 'rank-'+(i+1) : '';

        return `
          <div class="ranking-item ${rankClass} ${penaltyClass}" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 6px; box-sizing: border-box; width: 100%;">
            
            <!-- 1. 등수 좌측 고정 -->
            <span class="rank-num" style="flex-shrink: 0; width: 22px; text-align: left;">${i+1}</span>
            
            <!-- 2. 이름 및 최근 날짜 -->
            <div class="rank-name" style="display: flex; align-items: center; gap: 4px; flex: 1; min-width: 0; text-align: left; overflow: hidden; white-space: nowrap;">
              <span style="font-size: 17px; font-weight: bold; flex-shrink: 0;">${m.name}${isPenalty ? '⚠️' : ''}</span>
              <span style="font-weight: 600; color: #2f3542; font-size: 12px; background: #eccc68; padding: 1px 4px; border-radius: 4px; flex-shrink: 1; overflow: hidden; text-overflow: ellipsis;">최근: ${m.lastDate}</span>
            </div>
            
            <!-- 3. 우측 고정 영역 -->
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <button onclick="showMemberAttendanceDetail('${m.name}')" style="background: #f1f3f5; border: 1px solid #dee2e6; color: #495057; font-size: 11px; font-weight: bold; cursor: pointer; padding: 3px 6px; border-radius: 5px; white-space: nowrap;">
                현황보기
              </button>
              <span class="rank-val" style="white-space: nowrap; font-size: 14px; min-width: 65px; text-align: right;">
                ${m.count}회 (<span style="font-size: 14px; font-weight: bold;">${m.rate}%</span>)
              </span>
            </div>

          </div>`;
      }).join('');
    }








    async function scanImageLocal(input) {
      const nameSelect = document.getElementById('runName');
      if (!nameSelect.value) {
        input.value = ""; 
        return;
      }

      if (!input.files || !input.files[0]) return;
      
      const statusEl = document.getElementById('scanStatus');
      statusEl.style.display = 'block'; 
      statusEl.innerText = "🔍 이미지 분석 중...";

      try {
        const worker = await Tesseract.createWorker('eng');
        await worker.setParameters({ 
          tessedit_char_whitelist: '0123456789.:\'" ' 
        });

        const { data: { text } } = await worker.recognize(input.files[0]);
        await worker.terminate();

        let dist = "", pace = "", time = "";
        const distMatch = text.match(/(\d{1,2}[\.\,]\d{2})/);
        if (distMatch) dist = distMatch[0].replace(',', '.');
        const paceMatch = text.match(/(\d{1,2}'\d{2})/);
        if (paceMatch) pace = paceMatch[0].trim();
        const timeMatches = text.match(/(\d{1,2}:\d{2}(?::\d{2})?)/g);
        if (timeMatches) time = timeMatches.length > 1 ? timeMatches[1] : timeMatches[0];

        document.getElementById('runDist').value = dist;
        document.getElementById('runPace').value = pace;
        document.getElementById('runTime').value = time;

        statusEl.innerText = "✅ 분석 완료";
        
        if (!confirm(`${nameSelect.value}님, 스캔 결과가 맞나요?\n틀린 부분은 직접 수정 가능합니다.`)) {
          document.getElementById('runDist').focus();
        }
      } catch(e) { 
        console.error(e);
        statusEl.innerText = "❌ 스캔 실패 (수동 입력을 이용해 주세요)"; 
      }
    }

    document.addEventListener('DOMContentLoaded', () => {
      const runImgLabel = document.querySelector('label[for="runImg"]');
      const runNameSelect = document.getElementById('runName');

      runImgLabel.addEventListener('click', (e) => {
        if (!runNameSelect.value) {
          e.preventDefault();
          alert("이름을 선택해주세요!");
          runNameSelect.focus();
        }
      });
    });

    function openNoticeModal() {
      const noticeHtml = `
        <div style="text-align:left; line-height:1.6;">
          <h3 style="text-align:center; color:#e74c3c; font-size: 20px;">📢 ARC 2기 운영 수칙</h3>
          
          <div style="background:#fef2f2; padding:12px; border-radius:10px; margin:15px 0; border:1px solid #fee2e2;">
            <p><b>💰 회비:</b> 월 2만원 (15~20일)</p>
            <p style="font-size:13px; color:#c0392b; font-weight:bold;">카뱅 3333-16-7331916</p>
          </div>
          
          <p><b>🏃 정기모임:</b> 수·금·토 (20:00)</p>
          <p style="font-size:12px; color:#666;">- 참석률 33.3% 미달 시 회비 2배</p>
          <p><b>⚠️ 참석보고:</b> 당일 19시까지!</p>
          
          <div style="margin-top:20px; padding:15px; background:#f8f9fa; border-radius:12px; border:1px solid #eee;">
            <p style="margin-bottom:8px; font-size:15px;">👑 <b style="color:#333;">회장 :</b> <span style="font-size:18px; color:#000;">고영지</span></p>
            <p style="margin-bottom:8px; font-size:15px;">🥈 <b style="color:#333;">부회장 :</b> <span style="font-size:18px; color:#000;">윤민혁</span></p>
            <p style="font-size:15px;">💼 <b style="color:#333;">총무 :</b> <span style="font-size:18px; color:#000;">김민수</span></p>
          </div>

          <div style="margin-top:25px;">
            <button onclick="goToAttendance()" style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:12px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow: 0 4px 6px rgba(39,174,96,0.2);">
              🏃‍♂️ 지금 출석 체크하러 가기
            </button>
          </div>
        </div>
      `;
      const modalContent = document.querySelector('#noticeModal .modal-content');
      modalContent.innerHTML = noticeHtml + '<button class="btn-main" onclick="closeNoticeModal()" style="margin-top:15px; background:#eee; color:#666; border:none;">닫기</button>';
      document.getElementById('noticeModal').classList.add('active');
    }

    function goToAttendance() {
      closeNoticeModal();
      showPage('attendance');
    }

    async function updateWeather() {
      const apiKey = "c1aa66c2cae50680cddc975fbf80a45a";
      try {
        const currRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${TARGET.lat}&lon=${TARGET.lng}&appid=${apiKey}&units=metric`);
        if(currRes.ok) { const d = await currRes.json(); document.getElementById('currTemp').innerText = Math.round(d.main.temp); }
        const foreRes = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${TARGET.lat}&lon=${TARGET.lng}&appid=${apiKey}&units=metric`);
        if(foreRes.ok) {
          const fd = await foreRes.json(); const t = fd.list[0];
          document.getElementById('tonightTemp').innerText = Math.round(t.main.temp);
          document.getElementById('tonightFeel').innerText = Math.round(t.main.feels_like);
          document.getElementById('rainPop').innerText = Math.round(t.pop * 100);
          document.getElementById('rainForecast').innerText = t.rain ? (t.rain['3h'] || 0) : 0;
        }
      } catch (e) {}
    }

    async function loadAttendance() {
      const { data } = await supabaseClient.from('attendance').select('name');
      const countsAtt = {}; MEMBERS.forEach(m => countsAtt[m] = 0);
      data?.forEach(r => { if(countsAtt[r.name] !== undefined) countsAtt[r.name]++; });
      document.getElementById('memberGrid').innerHTML = MEMBERS.map(m => `<div class="member-card" onclick="doAttend('${m}')"><b>${m}</b><br><small style="color:#999">${countsAtt[m]}회</small></div>`).join('');
      document.getElementById('attendanceBody').innerHTML = MEMBERS.map(m => `<tr><td>${m}</td><td>${countsAtt[m]}회</td><td>${Math.round(countsAtt[m]/TOTAL*100)}%</td><td><button class="adj-btn" onclick="adjustAttendance('${m}', 1)">+</button> <button class="adj-btn" onclick="adjustAttendance('${m}', -1)">-</button></td></tr>`).join('');
    }

    function checkLocation() {
      const bar = document.getElementById('locBar'), txt = document.getElementById('locText');
      navigator.geolocation.getCurrentPosition(p => {
        const d = Math.round(getDist(p.coords.latitude, p.coords.longitude, TARGET.lat, TARGET.lng));
        locationOk = (d <= 500); bar.className = locationOk ? 'loc-bar ok' : 'loc-bar bad';
        txt.textContent = locationOk ? `✅ 출석 가능 (${d}m)` : `너무 멀어요 (${d}m)`;
      }, null, { enableHighAccuracy: true });
    }

    function getDist(l1, g1, l2, g2) {
      const R = 6371000, dL = (l2-l1)*Math.PI/180, dG = (g2-g1)*Math.PI/180;
      const a = Math.sin(dL/2)**2 + Math.cos(l1*Math.PI/180)*Math.cos(l2*Math.PI/180)*Math.sin(dG/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    async function loadNotices() {
      const { data } = await supabaseClient.from('notices').select('*').order('created_at', { ascending: false });
      allNotices = data;
      const { data: cmtData } = await supabaseClient.from('comments').select('post_id');
      const cCounts = {}; cmtData?.forEach(c => cCounts[c.post_id] = (cCounts[c.post_id] || 0) + 1);
      document.getElementById('noticeList').innerHTML = data.map((n, i) => `
        <div class="notice-item" onclick="openPostModal(${i})">
          <button class="delete-btn" onclick="event.stopPropagation(); deleteNotice(${n.id})">삭제</button>
          <h4>${n.title}</h4>
          <div style="font-size:11px; color:#bbb;">${n.author} / ${n.created_at.slice(5,16)}</div>
          ${n.image_url ? `<img src="${n.image_url}" class="notice-img">` : ''}
          <div class="like-area" style="font-size:12px; color:#888;">
            👍 ${n.likes_count||0} 👎 ${n.dislikes_count||0} 💬 ${cCounts[n.id]||0}
          </div>
        </div>`).join('');
    }

    async function openPostModal(idx) {
      const n = allNotices[idx]; currentPostId = n.id;
      document.getElementById('modalDetailContent').innerHTML = `<h3>${n.title}</h3><p>${n.content}</p>${n.image_url?`<img src="${n.image_url}" style="width:100%; border-radius:10px; margin-top:10px;">`:''}`;
      document.getElementById('modalLikeArea').innerHTML = `<div class="like-btn" onclick="handleReaction(${n.id},'like')">👍 ${n.likes_count||0}</div><div class="like-btn" onclick="handleReaction(${n.id},'dislike')">👎 ${n.dislikes_count||0}</div>`;
      loadComments(n.id);
      document.getElementById('postDetailModal').classList.add('active');
    }

    async function loadComments(pid) {
      const { data } = await supabaseClient.from('comments').select('*').eq('post_id', pid);
      document.getElementById('commentList').innerHTML = data.map(c => `<div class="cmt-item"><span>${c.content}</span><span class="cmt-del" onclick="deleteComment(${c.id},'${c.password}')">X</span></div>`).join('');
    }

    async function handleReaction(id, type) {
      const col = type === 'like' ? 'likes_count' : 'dislikes_count';
      const { data } = await supabaseClient.from('notices').select(col).eq('id', id).single();
      await supabaseClient.from('notices').update({ [col]: (data[col] || 0) + 1 }).eq('id', id);
      loadNotices(); closePostModal();
    }

    function showPage(id) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById('page-' + id).classList.add('active');
      if(id==='home') loadHomeRanking();
      if(id==='attendance') { checkLocation(); loadAttendance(); }
      if(id==='freeboard') loadNotices();
      if(id==='calendar') renderCalendar();
      if(id==='etc') loadRuns();
      if(id==='omok') initOmokPage();
    }

    function closeNoticeModal() { document.getElementById('noticeModal').classList.remove('active'); }
    function closePostModal() { document.getElementById('postDetailModal').classList.remove('active'); }
    async function deleteNotice(id) { const pw = prompt('비번'); if(pw===MASTER_KEY) { await supabaseClient.from('notices').delete().eq('id',id); loadNotices(); } }
    
    function renderCalendar() {
      const d = new Date(), y = d.getFullYear(), m = d.getMonth();
      document.getElementById('calendarMonth').innerText = `${y}년 ${m+1}월`;
      const grid = document.getElementById('calendarGrid'), first = new Date(y, m, 1).getDay(), last = new Date(y, m+1, 0).getDate();
      grid.innerHTML = ['일','월','화','수','목','금','토'].map(l => `<div class="calendar-label">${l}</div>`).join('');
      for(let i=0; i<first; i++) grid.innerHTML += `<div></div>`;
      for(let i=1; i<=last; i++) grid.innerHTML += `<div class="calendar-day ${i===d.getDate()?'today':''}">${i}</div>`;
    }

    async function saveRun() {
      const n = document.getElementById('runName').value, d = document.getElementById('runDist').value, p = document.getElementById('runPace').value, t = document.getElementById('runTime').value;
      const fileInput = document.getElementById('runImg'); let url = null;
      if (fileInput.files.length > 0) {
        const fn = `run_${Date.now()}.jpg`; await supabaseClient.storage.from('runs').upload(fn, fileInput.files[0]);
        url = supabaseClient.storage.from('runs').getPublicUrl(fn).data.publicUrl;
      }
      await supabaseClient.from('runs').insert([{ name:n, dist:d, pace:p, time:t, image_url:url }]);
      alert("저장 완료!"); loadRuns();
    }

    async function loadRuns() {
      const { data } = await supabaseClient.from('runs').select('*').order('created_at', { ascending: false });
      document.getElementById('runBody').innerHTML = data.map(r => `
        <tr><td>${r.created_at.slice(5,10)}</td><td>${r.name}</td><td>${r.dist}km</td><td>${r.pace}</td>
        <td>${r.image_url ? `<button onclick="window.open('${r.image_url}')">📷</button>` : ''}<button onclick="deleteRun(${r.id})">❌</button></td></tr>`).join('');
    }

    async function deleteRun(id) { if(prompt("마스터키")===MASTER_KEY) { await supabaseClient.from('runs').delete().eq('id',id); loadRuns(); } }

    async function doAttend(name) {
      if (!locationOk) {
        alert("위치 인증이 되지 않았습니다. 근처에서 시도해주세요.");
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const storageKey = `attended_${todayStr}`;
      const savedName = localStorage.getItem(storageKey);

      if (savedName) {
        if (savedName === name) {
          if (confirm(`오늘 [${name}]님으로 이미 출석하셨습니다.\n출석을 취소하고 다른 사람으로 다시 체크하시겠습니까?`)) {
            try {
              const { data: record } = await supabaseClient
                .from('attendance')
                .select('id')
                .eq('name', name)
                .gte('created_at', todayStr)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (record) {
                await supabaseClient.from('attendance').delete().eq('id', record.id);
              }

              localStorage.removeItem(storageKey);
              alert("출석이 취소되었습니다. 이제 다른 이름으로 출석할 수 있습니다.");
              loadAttendance();
              loadHomeRanking();
            } catch (e) {
              alert("취소 처리 중 오류가 발생했습니다.");
            }
          }
        } else {
          alert(`이 기기에서는 오늘 이미 [${savedName}]님으로 출석이 완료되었습니다.\n수정이 필요하면 [${savedName}] 이름을 눌러 취소 후 다시 시도해주세요.`);
        }
        return;
      }

      if (confirm(`[${name}]님으로 오늘 출석을 체크하시겠습니까?\n(기기당 하루 1회만 가능)`)) {
        try {
          const { error } = await supabaseClient
            .from('attendance')
            .insert([{ name: name }]);

          if (error) throw error;

          localStorage.setItem(storageKey, name);
          alert(`[${name}]님, 출석 체크 완료!`);
          
          loadAttendance();
          loadHomeRanking();
        } catch (e) {
          console.error(e);
          alert("출석 저장 중 오류가 발생했습니다.");
        }
      }
    }

    async function adjustAttendance(name, amount) {
      const key = prompt("관리자 비밀번호를 입력하세요.");
      if (key !== ADMIN_KEY && key !== MASTER_KEY) {
        alert("비밀번호가 틀렸습니다.");
        return;
      }

      if (amount > 0) {
        const { error } = await supabaseClient
          .from('attendance')
          .insert([{ name: name }]);
        
        if (error) {
          alert("추가 중 오류 발생");
          return;
        }
      } else {
        const { data: latestRecord } = await supabaseClient
          .from('attendance')
          .select('id')
          .eq('name', name)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latestRecord) {
          const { error } = await supabaseClient
            .from('attendance')
            .delete()
            .eq('id', latestRecord.id);
          
          if (error) {
            alert("삭제 중 오류 발생");
            return;
          }
        } else {
          alert("삭제할 출석 기록이 없습니다.");
          return;
        }
      }

      alert("조정 완료!");
      loadAttendance();
      loadHomeRanking();
    }

    /* ===================== 오목 게임 로직 ===================== */
    const omokCanvas = document.getElementById('omokCanvas');
    const omokCtx = omokCanvas.getContext('2d');
    const statusEl = document.getElementById('omokStatus');
    const levelEl = document.getElementById('omokLevelDisplay');
    const startOverlay = document.getElementById('omokStartOverlay');
    const resultOverlay = document.getElementById('omokResultOverlay');

    const OMOK_SIZE = 13;
    let omokCellSize, omokPadding, omokBoard, omokGameOver = true, omokTurn = 1, currentLevel = 1;
    let omokInitialized = false;

    const levels = {
      1: { name: "1단계 🌱", weight: 100, defense: 10.0, randomness: 0, color: "#2ecc71" },
      2: { name: "2단계 🌿", weight: 200, defense: 50, randomness: 0, color: "#a2de96" },
      3: { name: "3단계 🌳", weight: 300, defense: 600, randomness: 10, color: "#f1c40f" },
      4: { name: "4단계 🔥", weight: 400, defense: 800, randomness: 0, color: "#e67e22" },
      5: { name: "5단계 👑", weight: 500, defense: 1000, randomness: 0, color: "#e74c3c" },
      6: { name: "6단계 🌌", weight: 1000, defense: 2000, randomness: 0, color: "#ffffff" }
    };

    function initOmokPage() {
      if (!omokInitialized) {
        omokResize();
        omokCanvas.addEventListener('mousedown', omokHandleInput);
        omokCanvas.addEventListener('touchstart', (e) => { e.preventDefault(); omokHandleInput(e); }, {passive:false});
        window.addEventListener('resize', omokResize);
        omokInitialized = true;
      } else {
        omokResize();
      }
    }

    function omokResize() {
      omokCanvas.width = 1000;
      omokCanvas.height = 1000;
      omokPadding = omokCanvas.width * 0.05;
      omokCellSize = (omokCanvas.width - omokPadding * 2) / (OMOK_SIZE - 1);
      omokDraw();
    }

    function startOmokGame() {
      startOverlay.style.display = 'none';
      omokInitGame();
    }

    function omokInitGame() {
      omokBoard = Array.from({ length: OMOK_SIZE }, () => Array(OMOK_SIZE).fill(0));
      omokGameOver = false; omokTurn = 1;
      statusEl.innerText = "내 차례 (흑)";
      const lv = levels[currentLevel];
      levelEl.innerText = lv.name;
      levelEl.style.color = lv.color;
      levelEl.style.borderColor = lv.color;
      omokDraw();
    }

    function omokDraw() {
      omokCtx.clearRect(0, 0, omokCanvas.width, omokCanvas.height);
      omokCtx.strokeStyle = '#444';
      omokCtx.lineWidth = 2;
      for (let i = 0; i < OMOK_SIZE; i++) {
        const pos = omokPadding + i * omokCellSize;
        omokCtx.beginPath(); omokCtx.moveTo(omokPadding, pos); omokCtx.lineTo(omokCanvas.width - omokPadding, pos); omokCtx.stroke();
        omokCtx.beginPath(); omokCtx.moveTo(pos, omokPadding); omokCtx.lineTo(pos, omokCanvas.height - omokPadding); omokCtx.stroke();
      }
      if (!omokBoard) return;
      for (let r = 0; r < OMOK_SIZE; r++) {
        for (let c = 0; c < OMOK_SIZE; c++) {
          if (omokBoard[r][c] !== 0) {
            const x = omokPadding + c * omokCellSize, y = omokPadding + r * omokCellSize;
            omokCtx.beginPath(); omokCtx.arc(x, y, omokCellSize * 0.42, 0, Math.PI * 2);
            omokCtx.fillStyle = omokBoard[r][c] === 1 ? "#000" : "#fff";
            omokCtx.fill(); omokCtx.strokeStyle = "#000"; omokCtx.lineWidth = 1; omokCtx.stroke();
          }
        }
      }
    }

    function omokHandleInput(e) {
      if (omokGameOver || omokTurn !== 1) return;
      const rect = omokCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = (clientX - rect.left) * (omokCanvas.width / rect.width);
      const y = (clientY - rect.top) * (omokCanvas.height / rect.height);
      const c = Math.round((x - omokPadding) / omokCellSize), r = Math.round((y - omokPadding) / omokCellSize);
      
      if (r >= 0 && r < OMOK_SIZE && c >= 0 && c < OMOK_SIZE && omokBoard[r][c] === 0) {
        omokBoard[r][c] = 1;
        if (omokCheckWin(r, c, 1)) { omokFinish(1); }
        else { omokTurn = 2; statusEl.innerText = "상대방 수 생각 중..."; omokDraw(); setTimeout(omokAiTurn, 600); }
      }
    }

    function omokAiTurn() {
      let bestScore = -1, moves = [];
      const cfg = levels[currentLevel];
      for (let r = 0; r < OMOK_SIZE; r++) {
        for (let c = 0; c < OMOK_SIZE; c++) {
          if (omokBoard[r][c] === 0) {
            let score = 0;
            [[1,0],[0,1],[1,1],[1,-1]].forEach(([dr,dc]) => {
              const my = omokGetCont(r,c,dr,dc,2), op = omokGetCont(r,c,dr,dc,1);
              if(my > 0) score += Math.pow(cfg.weight, my);
              if(op > 0) score += Math.pow(cfg.weight+2, op) * cfg.defense;
            });
            score += Math.random() * cfg.randomness;
            if(score > bestScore) { bestScore = score; moves = [{r,c}]; }
            else if(score === bestScore) moves.push({r,c});
          }
        }
      }
      const m = moves[Math.floor(Math.random()*moves.length)];
      omokBoard[m.r][m.c] = 2;
      if (omokCheckWin(m.r, m.c, 2)) omokFinish(2);
      else { omokTurn = 1; statusEl.innerText = "내 차례 (흑)"; omokDraw(); }
    }

    function omokGetCont(r,c,dr,dc,t) {
      let cnt = 0;
      [[dr,dc],[-dr,-dc]].forEach(([tr,tc]) => {
        let nr=r+tr, nc=c+tc;
        while(nr>=0 && nr<OMOK_SIZE && nc>=0 && nc<OMOK_SIZE && omokBoard[nr][nc]===t) { cnt++; nr+=tr; nc+=tc; }
      });
      return cnt;
    }

    function omokCheckWin(r,c,t) { return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc]) => omokGetCont(r,c,dr,dc,t) >= 4); }

    function omokFinish(winner) {
      omokGameOver = true; omokDraw();
      setTimeout(() => {
        resultOverlay.style.display = 'flex';
        const msg = document.getElementById('omokOverlayMsg');
        const btn = document.getElementById('omokOverlayBtn');
        if(winner === 1) { 
          msg.innerText = "승리! 🎉"; currentLevel = Math.min(currentLevel+1, 6); 
          btn.className = "omok-btn next-btn"; btn.innerText = "다음 단계로";
        } else { 
          msg.innerText = "패배.. 💀"; 
          btn.className = "omok-btn retry-btn"; btn.innerText = "다시 도전";
        }
      }, 500);
    }

    function closeOmokOverlay() { resultOverlay.style.display = 'none'; omokInitGame(); }
      // [현황보기] 버튼을 누르면 실행되는 팝업창(모달) 함수
    function showMemberAttendanceDetail(name) {
      // 1. 해당 회원의 출석 날짜 배열 가져오기 (없으면 빈 배열)
      const dates = (window.currentAttendanceDates && window.currentAttendanceDates[name]) || [];
      
      // 2. 날짜 목록을 화면에 보여줄 글자로 만들기
      let contentHtml = '';
      if (dates.length === 0) {
        contentHtml = '<p style="text-align:center; color:#999; margin:20px 0;">출석 기록이 없습니다.</p>';
      } else {
        contentHtml = `
          <div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">
            <table style="width:100%; border-collapse:collapse; text-align:center; font-size:14px;">
              <thead>
                <tr style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
                  <th style="padding:8px; color:#495057;">번호</th>
                  <th style="padding:8px; color:#495057;">출석 날짜 (요일)</th>
                </tr>
              </thead>
              <tbody>
                ${dates.map((date, idx) => `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px; color:#868e96;">${idx + 1}</td>
                    <td style="padding:8px; font-weight:500; color:#212529;">${date}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      // 3. 팝업창(모달) 생성 및 띄우기
      const modal = document.createElement('div');
      modal.id = 'attendanceDetailModal';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999; padding:20px; box-sizing:border-box;';
      
      modal.innerHTML = `
        <div style="background:#fff; width:100%; max-width:320px; border-radius:12px; padding:20px; box-sizing:border-box; box-shadow:0 4px 15px rgba(0,0,0,0.2); animation: modalFadeIn 0.2s ease-out;">
          <h3 style="margin-top:0; margin-bottom:15px; text-align:center; color:#212529; font-size:17px;">
            <span style="color:#2f3542; font-weight:bold;">${name}</span> 님의 출석 현황
          </h3>
          
          ${contentHtml}
          
          <button onclick="document.getElementById('attendanceDetailModal').remove()" style="margin-top:15px; width:100%; background:#2f3542; color:#fff; border:none; padding:10px; font-size:14px; font-weight:bold; border-radius:6px; cursor:pointer;">
            닫기
          </button>
        </div>
      `;

      // 기존에 켜져있던 모달이 있다면 지우고 새로 띄움
      const oldModal = document.getElementById('attendanceDetailModal');
      if(oldModal) oldModal.remove();
      
      document.body.appendChild(modal);
    }

    // 전역 변수 초기화 (에러 방지용)
    window.currentAttendanceDates = window.currentAttendanceDates || {};