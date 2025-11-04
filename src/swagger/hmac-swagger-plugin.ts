/**
 * Swagger UI customization for HMAC authentication
 * This adds a client-side helper to automatically generate HMAC signatures
 */

export const hmacSwaggerPlugin = `
(function() {
  'use strict';
  
  // HMAC Helper UI
  const hmacHelperHTML = \`
    <div id="hmac-helper" style="
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fff;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 350px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <h3 style="margin: 0 0 10px 0; color: #4CAF50; font-size: 16px;">🔐 HMAC Helper</h3>
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 12px; color: #666; margin-bottom: 5px;">API Key:</label>
        <input 
          type="text" 
          id="hmac-api-key" 
          placeholder="pk_..."
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;"
        />
      </div>
      <div style="margin-bottom: 10px;">
        <label style="display: block; font-size: 12px; color: #666; margin-bottom: 5px;">API Secret:</label>
        <input 
          type="password" 
          id="hmac-api-secret" 
          placeholder="sk_..."
          style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 12px; box-sizing: border-box;"
        />
      </div>
      <button 
        id="hmac-save-btn"
        style="
          width: 100%; 
          padding: 8px; 
          background: #4CAF50; 
          color: white; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
        "
        onmouseover="this.style.background='#45a049'"
        onmouseout="this.style.background='#4CAF50'"
      >
        Save Credentials
      </button>
      <div id="hmac-status" style="margin-top: 10px; font-size: 11px; color: #666;"></div>
    </div>
  \`;
  
  // Inject HMAC Helper UI
  if (document.getElementById('hmac-helper') === null) {
    document.body.insertAdjacentHTML('beforeend', hmacHelperHTML);
  }
  
  // Generate HMAC-SHA256 signature
  async function generateHMACSignature(message, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Save credentials to localStorage
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'hmac-save-btn') {
      const apiKey = document.getElementById('hmac-api-key').value;
      const apiSecret = document.getElementById('hmac-api-secret').value;
      
      if (apiKey && apiSecret) {
        localStorage.setItem('hmac_api_key', apiKey);
        localStorage.setItem('hmac_api_secret', apiSecret);
        document.getElementById('hmac-status').textContent = '✅ Credentials saved!';
        document.getElementById('hmac-status').style.color = '#4CAF50';
        setTimeout(() => {
          document.getElementById('hmac-status').textContent = '';
        }, 2000);
      } else {
        document.getElementById('hmac-status').textContent = '❌ Please fill both fields';
        document.getElementById('hmac-status').style.color = '#f44336';
      }
    }
  });
  
  // Load saved credentials
  window.addEventListener('load', function() {
    const savedKey = localStorage.getItem('hmac_api_key');
    const savedSecret = localStorage.getItem('hmac_api_secret');
    
    if (savedKey) {
      document.getElementById('hmac-api-key').value = savedKey;
    }
    if (savedSecret) {
      document.getElementById('hmac-api-secret').value = savedSecret;
    }
  });
  
  // Intercept Swagger UI requests and add HMAC headers
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];
    const options = args[1] || {};
    
    // Only intercept requests to our API
    if (typeof url === 'string' && url.includes('/transactions') && options.method) {
      const apiKey = localStorage.getItem('hmac_api_key');
      const apiSecret = localStorage.getItem('hmac_api_secret');
      
      if (apiKey && apiSecret) {
        // Generate timestamp
        const timestamp = Math.floor(Date.now() / 1000).toString();
        
        // Get request body
        let bodyString = '';
        if (options.body) {
          if (typeof options.body === 'string') {
            bodyString = options.body;
          } else {
            bodyString = JSON.stringify(options.body);
          }
        }
        
        // Create payload: timestamp.body
        const payload = \`\${timestamp}.\${bodyString}\`;
        
        // Generate HMAC signature
        try {
          const signature = await generateHMACSignature(payload, apiSecret);
          
          // Add HMAC headers
          options.headers = options.headers || {};
          if (options.headers instanceof Headers) {
            options.headers.set('X-API-Key', apiKey);
            options.headers.set('X-Signature', signature);
            options.headers.set('X-Timestamp', timestamp);
          } else {
            options.headers['X-API-Key'] = apiKey;
            options.headers['X-Signature'] = signature;
            options.headers['X-Timestamp'] = timestamp;
          }
        } catch (error) {
          console.error('Failed to generate HMAC signature:', error);
        }
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  // Also intercept Swagger UI's internal request function
  if (window.ui && window.ui.specActions) {
    const originalExecuteRequest = window.ui.specActions.executeRequest;
    if (originalExecuteRequest) {
      window.ui.specActions.executeRequest = async function(...args) {
        const req = args[0];
        const apiKey = localStorage.getItem('hmac_api_key');
        const apiSecret = localStorage.getItem('hmac_api_secret');
        
        if (apiKey && apiSecret && req && req.url && req.url.includes('/transactions')) {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          let bodyString = req.body || '';
          
          if (typeof bodyString !== 'string') {
            bodyString = JSON.stringify(bodyString);
          }
          
          const payload = \`\${timestamp}.\${bodyString}\`;
          
          try {
            const signature = await generateHMACSignature(payload, apiSecret);
            
            req.headers = req.headers || {};
            req.headers['X-API-Key'] = apiKey;
            req.headers['X-Signature'] = signature;
            req.headers['X-Timestamp'] = timestamp;
          } catch (error) {
            console.error('Failed to generate HMAC signature:', error);
          }
        }
        
        return originalExecuteRequest.apply(this, args);
      };
    }
  }
  
  console.log('🔐 HMAC Swagger Plugin loaded!');
})();
`;

