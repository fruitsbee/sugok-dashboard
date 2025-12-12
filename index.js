// index.js (Vercel 배포용 서버 파일: 동적 메뉴 및 권한 제어)
const express = require('express');
const admin = require('firebase-admin');

// ★★★ [수정 완료] 클라이언트에서 사용할 Firebase CONFIG 설정 ★★★
// 이전에 사용했던 선생님의 공개(Client) 키가 여기에 정확히 삽입되었습니다.
const CLIENT_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCjkkF8LA-3SgfXEq9GyjW1kLoe9t53Hc", 
    authDomain: "happy-sugok-61e4e.firebaseapp.com", 
    projectId: "happy-sugok-61e4e", 
    appId: "1:456950732456:web:a1d3bd459372935b77949d" 
};

// 1. Firebase Admin SDK 초기화 (서버 관리용)
try {
    // Vercel 환경 변수에서 관리자 JSON 키를 로드합니다.
    const serviceAccountKey = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ 
      credential: admin.credential.cert(serviceAccountKey)
    });
} catch (error) {
    console.error("Firebase Admin SDK 초기화 실패: Vercel 환경 변수 'FIREBASE_SERVICE_ACCOUNT_KEY'를 확인하세요.", error);
}

const db = admin.firestore();
const app = express();
const MENU_COLLECTION = 'admin_menus';
const PORT = process.env.PORT || 3000; 

// 2. 서버의 기본 경로에 접속하면 HTML 생성
app.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection(MENU_COLLECTION).orderBy('order').get();
    const menus = snapshot.docs.map(doc => doc.data());
    let sidebarHtml = '';

    menus.forEach(menu => {
      const lockClass = menu.access_role !== 'public' ? 'locked-menu auth-required' : '';
      const lockIcon = menu.access_role !== 'public' ? '🔒' : '';
      
      sidebarHtml += `
        <div class="menu-item ${lockClass}" data-role="${menu.access_role}" onclick="showPage('${menu.id}')">
          <span class="icon">${menu.icon}</span> ${menu.title} ${lockIcon}
        </div>
      `;
    });

    const fullHtml = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <title>수곡초 동적 메뉴</title>
            <style>
                body { font-family: sans-serif; background-color: #f7f7f5; color: #37352f; }
                .sidebar { width: 250px; height: 100vh; position: fixed; background: #f7f7f5; padding: 20px; }
                .menu-item { padding: 8px 12px; margin-bottom: 2px; border-radius: 5px; cursor: pointer; display: flex; align-items: center; }
                .locked-menu { opacity: 0.5; pointer-events: none; }
                .btn-login { background-color: #2383e2; color: white; border: none; padding: 8px; border-radius: 5px; width: 100%; }
                .main-content { margin-left: 250px; padding: 50px; background: white; min-height: 100vh; }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <h4>🏫 수곡초 워크스페이스</h4>
                <div id="user-info-area">
                    <button id="login-btn" class="btn-login" onclick="googleLogin()">G 구글 로그인</button>
                    <div id="user-profile" style="display: none;">
                        <span id="user-name"></span>님 
                        <button onclick="googleLogout()" style="float:right;">로그아웃</button>
                    </div>
                </div>
                <p style="margin-top:20px;">메뉴:</p>
                ${sidebarHtml}
            </div>
            <div class="main-content" id="main-view"><h1>대시보드</h1></div>
            
            <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js"></script>
            <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js"></script>
            <script type="module">
                import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
                import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } 
                from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
                
                // 서버에서 삽입된 클라이언트 설정 사용
                const firebaseConfig = ${JSON.stringify(CLIENT_FIREBASE_CONFIG)};
                const app = initializeApp(firebaseConfig);
                const auth = getAuth(app);
                const provider = new GoogleAuthProvider();

                let currentUserRole = 'guest';

                // ★★★ [수정 완료] 관리자 권한 부여 이메일 설정 ★★★
                // 선생님께서 제공하신 서비스 계정 정보에서 클라이언트 이메일을 사용했습니다.
                // 보안상의 이유로 선생님의 실제 교사 이메일로 반드시 바꿔주십시오.
                const ADMIN_EMAIL = 'firebase-adminsdk-fbsvc@happy-sugok-61e4e.iam.gserviceaccount.com'; // <--- 선생님의 실제 교사 이메일로 반드시 교체하세요!

                window.googleLogin = () => signInWithPopup(auth, provider).catch(error => console.error(error));
                window.googleLogout = () => signOut(auth);

                onAuthStateChanged(auth, (user) => {
                    const loginBtn = document.getElementById('login-btn');
                    const userProfile = document.getElementById('user-profile');
                    const lockedMenus = document.querySelectorAll('.auth-required');

                    if (user) {
                        // 로그인 성공
                        loginBtn.style.display = 'none';
                        userProfile.style.display = 'block';
                        document.getElementById('user-name').innerText = user.displayName;

                        // 역할 설정: 로그인한 이메일이 ADMIN_EMAIL과 일치하면 'admin' 부여
                        currentUserRole = user.email === ADMIN_EMAIL ? 'admin' : 'teacher';
                        
                        lockedMenus.forEach(menu => {
                            const requiredRole = menu.dataset.role;
                            
                            if (currentUserRole === 'admin' || (currentUserRole === 'teacher' && requiredRole !== 'admin')) {
                                menu.classList.remove('locked-menu');
                                menu.style.pointerEvents = 'auto'; 
                                menu.querySelector('span:last-child').innerText = ''; 
                            }
                        });

                    } else {
                        // 로그아웃 상태 (Guest)
                        currentUserRole = 'guest';
                        loginBtn.style.display = 'block';
                        userProfile.style.display = 'none';

                        lockedMenus.forEach(menu => {
                            menu.classList.add('locked-menu');
                            menu.style.pointerEvents = 'none'; 
                        });
                    }
                });

                window.showPage = (pageId) => {
                    document.getElementById('main-view').innerHTML = `<h1>${pageId} 페이지</h1><p>여기에 ${pageId}의 내용이 로드됩니다.</p>`;
                };
                
                // 초기 페이지 로드
                document.addEventListener('DOMContentLoaded', () => {
                    window.showPage('dashboard');
                });
            </script>
        </body>
        </html>
    `;

    res.send(fullHtml);

  } catch (error) {
    console.error("페이지 로드 중 오류:", error);
    res.status(500).send("서버 오류: DB 연결 및 메뉴 컬렉션을 확인해주세요.");
  }
});

// 5. 서버 실행 (Vercel 환경 변수 PORT 사용)
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
});
