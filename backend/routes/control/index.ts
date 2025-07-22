export default async function (fastify: any) {
  // コントロールページのHTML
  fastify.get('/', async (request: any, reply: any) => {
    const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bot Control Panel</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        
        .section {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 25px;
            margin-bottom: 20px;
            border-left: 4px solid #007bff;
        }
        
        .section h2 {
            color: #333;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #333;
        }
        
        select, input, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .color-input {
            width: 60px;
            height: 40px;
            padding: 0;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        
        button {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 12px 25px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 500;
            transition: all 0.3s ease;
            margin-right: 10px;
        }
        
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
        }
        
        .btn-test {
            background: linear-gradient(135deg, #28a745, #20c997);
        }
        
        .btn-test:hover {
            box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3);
        }
        
        .preview {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin-top: 15px;
        }
        
        .embed-preview {
            border-left: 4px solid #007bff;
            padding-left: 15px;
        }
        
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }
        
        .result.success {
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
        
        .result.error {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            .header h1 {
                font-size: 2em;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Bot Control Panel</h1>
            <p>サーバー管理とBot操作のコントロールパネル</p>
        </div>
        
        <div class="section">
            <h2>📢 カスタム通知送信</h2>
            <form id="notifyForm">
                <div class="form-group">
                    <label for="channelId">送信先チャンネル:</label>
                    <select id="channelId" required>
                        <option value="">チャンネルを選択...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="title">タイトル:</label>
                    <input type="text" id="title" placeholder="例: 今日のゲーム予定" value="📢 お知らせ">
                </div>
                
                <div class="form-group">
                    <label for="message">メッセージ:</label>
                    <textarea id="message" placeholder="送信したいメッセージを入力..." required>テスト通知です！</textarea>
                </div>
                
                <div class="form-group">
                    <label for="color">埋め込み色:</label>
                    <input type="color" id="color" class="color-input" value="#007bff">
                </div>
                
                <div class="preview" id="preview">
                    <div class="embed-preview">
                        <strong id="previewTitle">📢 お知らせ</strong>
                        <p id="previewMessage">テスト通知です！</p>
                        <small style="color: #666;">今すぐ</small>
                    </div>
                </div>
                
                <button type="button" onclick="sendTest()" class="btn-test">🧪 テスト送信</button>
                <button type="submit">📤 送信</button>
            </form>
            
            <div class="result" id="result"></div>
        </div>
        
        <div class="section">
            <h2>🎮 今後の機能 (準備中)</h2>
            <p>• ゲーム参加アンケート機能</p>
            <p>• メンバー管理</p>
            <p>• 統計ダッシュボード</p>
            <p>• 一時チャンネル作成</p>
        </div>
    </div>

    <script>
        let guilds = [];
        
        // ページ読み込み時にサーバー情報を取得
        async function loadGuilds() {
            try {
                const response = await fetch('/api/guilds?includeChannels=true');
                const data = await response.json();
                guilds = data.guilds;
                
                const channelSelect = document.getElementById('channelId');
                channelSelect.innerHTML = '<option value="">チャンネルを選択...</option>';
                
                guilds.forEach(guild => {
                    guild.textChannels?.forEach(channel => {
                        channelSelect.innerHTML += '<option value="' + channel.id + '">' + guild.name + ' - #' + channel.name + '</option>';
                    });
                });
            } catch (error) {
                console.error('サーバー情報の取得に失敗:', error);
            }
        }
        
        // プレビュー更新
        function updatePreview() {
            const title = document.getElementById('title').value || '📢 お知らせ';
            const message = document.getElementById('message').value || 'メッセージが入力されていません';
            const color = document.getElementById('color').value;
            
            document.getElementById('previewTitle').textContent = title;
            document.getElementById('previewMessage').textContent = message;
            
            const preview = document.querySelector('.embed-preview');
            preview.style.borderLeftColor = color;
        }
        
        // テスト送信
        async function sendTest() {
            const channelId = document.getElementById('channelId').value;
            if (!channelId) {
                showResult('チャンネルを選択してください', 'error');
                return;
            }
            
            await sendNotification(true);
        }
        
        // フォーム送信
        document.getElementById('notifyForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendNotification(false);
        });
        
        // 通知送信
        async function sendNotification(isTest) {
            const channelId = document.getElementById('channelId').value;
            const title = document.getElementById('title').value;
            const message = document.getElementById('message').value;
            const color = document.getElementById('color').value;
            
            if (!channelId || !message) {
                showResult('必要な項目を入力してください', 'error');
                return;
            }
            
            try {
                const response = await fetch('/control/send-notification', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        channelId,
                        title: isTest ? '[テスト] ' + title : title,
                        message,
                        color: color.replace('#', '0x'),
                        isTest
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showResult(
                        isTest ? 'テスト通知を送信しました！' : '通知を送信しました！',
                        'success'
                    );
                    
                    if (!isTest) {
                        // フォームをリセット
                        document.getElementById('message').value = '';
                    }
                } else {
                    showResult('エラー: ' + result.error, 'error');
                }
            } catch (error) {
                showResult('送信エラー: ' + error.message, 'error');
            }
        }
        
        // 結果表示
        function showResult(message, type) {
            const result = document.getElementById('result');
            result.textContent = message;
            result.className = 'result ' + type;
            result.style.display = 'block';
            
            setTimeout(() => {
                result.style.display = 'none';
            }, 5000);
        }
        
        // イベントリスナー
        document.getElementById('title').addEventListener('input', updatePreview);
        document.getElementById('message').addEventListener('input', updatePreview);
        document.getElementById('color').addEventListener('change', updatePreview);
        
        // 初期化
        loadGuilds();
        updatePreview();
    </script>
</body>
</html>`;
    
    reply.type('text/html').send(html);
  });

  // 通知送信API
  fastify.post('/send-notification', async (request: any, reply: any) => {
    try {
      const { channelId, title, message, color, isTest } = request.body;
      
      if (!fastify.discord || !fastify.discord.isReady()) {
        return reply.code(503).send({ 
          success: false, 
          error: 'Discord Botが接続されていません' 
        });
      }
      
      const channel = fastify.discord.channels.cache.get(channelId);
      if (!channel) {
        return reply.code(404).send({ 
          success: false, 
          error: 'チャンネルが見つかりません' 
        });
      }
      
      const embed = {
        title: title || '📢 お知らせ',
        description: message,
        color: parseInt(color) || 0x007bff,
        timestamp: new Date().toISOString(),
        footer: {
          text: isTest ? '🧪 テスト送信' : 'Bot Control Panel より送信'
        }
      };
      
      await channel.send({ embeds: [embed] });
      
      return { success: true, message: 'メッセージを送信しました' };
    } catch (error) {
      console.error('通知送信エラー:', error);
      return reply.code(500).send({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}