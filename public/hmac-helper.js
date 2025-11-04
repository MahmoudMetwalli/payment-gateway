/**
 * HMAC Helper for Swagger UI
 * Automatically generates HMAC signatures for transaction endpoints
 */

(function() {
  'use strict';
  
  // HMAC Helper UI
  const hmacHelperHTML = `
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
      <div style="margin-top: 10px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
        <strong>How to use:</strong><br/>
        1. Enter your API Key and Secret<br/>
        2. Click "Save Credentials"<br/>
        3. Try any endpoint - headers auto-generated!
      </div>
    </div>
  `;
  
      // Deterministic JSON normalization (same as server)
      // Recursively sorts all object keys for consistent output
      function normalizeDeterministic(obj) {
        if (obj === null || obj === undefined) {
          return null;
        }

        if (typeof obj !== 'object') {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.map(item => normalizeDeterministic(item));
        }

        // Sort keys and recursively process nested objects
        const sortedKeys = Object.keys(obj).sort();
        const sortedObj = {};
        for (const key of sortedKeys) {
          sortedObj[key] = normalizeDeterministic(obj[key]);
        }

        return sortedObj;
      }

      // Generate HMAC-SHA256 signature using Web Crypto API
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
  
  // Wait for Swagger UI to load
  function initHMACHelper() {
    if (document.getElementById('swagger-ui') || document.querySelector('.swagger-ui')) {
      // Inject HMAC Helper UI
      if (document.getElementById('hmac-helper') === null) {
        document.body.insertAdjacentHTML('beforeend', hmacHelperHTML);
      }
      
      // Save credentials to localStorage
      const saveBtn = document.getElementById('hmac-save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', function() {
          const apiKey = document.getElementById('hmac-api-key').value;
          const apiSecret = document.getElementById('hmac-api-secret').value;
          
          if (apiKey && apiSecret) {
            localStorage.setItem('hmac_api_key', apiKey);
            localStorage.setItem('hmac_api_secret', apiSecret);
            const statusEl = document.getElementById('hmac-status');
            statusEl.textContent = '✅ Credentials saved!';
            statusEl.style.color = '#4CAF50';
            setTimeout(() => {
              statusEl.textContent = '';
            }, 2000);
          } else {
            const statusEl = document.getElementById('hmac-status');
            statusEl.textContent = '❌ Please fill both fields';
            statusEl.style.color = '#f44336';
          }
        });
      }
      
      // Load saved credentials
      const savedKey = localStorage.getItem('hmac_api_key');
      const savedSecret = localStorage.getItem('hmac_api_secret');
      
      if (savedKey && document.getElementById('hmac-api-key')) {
        document.getElementById('hmac-api-key').value = savedKey;
      }
      if (savedSecret && document.getElementById('hmac-api-secret')) {
        document.getElementById('hmac-api-secret').value = savedSecret;
      }
      
      // Function to auto-fill HMAC headers in Swagger UI
      function autoFillHMACHeaders() {
        const apiKey = localStorage.getItem('hmac_api_key');
        const apiSecret = localStorage.getItem('hmac_api_secret');
        
        if (!apiKey || !apiSecret) {
          // Show warning if credentials not set
          const statusEl = document.getElementById('hmac-status');
          if (statusEl) {
            statusEl.textContent = '⚠️ Please save your API credentials first';
            statusEl.style.color = '#ff9800';
          }
          return;
        }
        
        // Find all header input fields for HMAC headers by multiple methods
        const allInputs = document.querySelectorAll('.parameters input[type="text"], .parameters input[type="password"], input[data-name], input[placeholder]');
        allInputs.forEach(input => {
          // Try multiple ways to identify the input
          const label = input.closest('tr')?.querySelector('label');
          const inputId = input.id || '';
          const inputName = input.getAttribute('data-name') || input.name || '';
          const placeholder = input.placeholder || '';
          const labelText = label ? label.textContent.toLowerCase() : '';
          
          // Check if this is X-API-Key
          if (labelText.includes('x-api-key') || labelText.includes('api key') || 
              inputId.includes('api-key') || inputName.includes('api-key') ||
              placeholder.toLowerCase().includes('x-api-key')) {
            if (!input.value || input.value !== apiKey) {
              input.value = apiKey;
              input.style.backgroundColor = '#f0f8f0';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        });
      }
      
      // Function to generate and fill HMAC headers before request
      async function generateAndFillHMACHeaders() {
        const apiKey = localStorage.getItem('hmac_api_key');
        const apiSecret = localStorage.getItem('hmac_api_secret');
        
        if (!apiKey || !apiSecret) {
          console.warn('HMAC credentials not found. Please save them in the HMAC Helper.');
          return;
        }
        
        // Find the request body from multiple possible locations
        let bodyString = '';
        const bodyEditor = document.querySelector('.body-param__texteditor textarea, .opblock-body textarea, textarea.body-param');
        
        if (bodyEditor && bodyEditor.value) {
          try {
            const bodyValue = bodyEditor.value.trim();
            if (bodyValue) {
              // Try to parse as JSON to ensure it's valid and normalize it
              const parsed = JSON.parse(bodyValue);
              bodyString = JSON.stringify(parsed);
            }
          } catch (e) {
            // If not valid JSON, use as-is
            bodyString = bodyEditor.value;
          }
        }
        
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const payload = `${timestamp}.${bodyString}`;
        
        try {
          const signature = await generateHMACSignature(payload, apiSecret);
          
          // Find and fill header inputs using multiple identification methods
          const allInputs = document.querySelectorAll('.parameters input[type="text"], .parameters input[type="password"], input[data-name], .opblock-section input');
          
          allInputs.forEach(input => {
            const label = input.closest('tr')?.querySelector('label') || input.closest('div')?.querySelector('label');
            const inputId = input.id || '';
            const inputName = input.getAttribute('data-name') || input.name || '';
            const placeholder = input.placeholder || '';
            const labelText = label ? label.textContent.toLowerCase() : '';
            
            // Check for X-API-Key
            if (labelText.includes('x-api-key') || labelText.includes('api key') || 
                inputId.includes('api-key') || inputName.includes('api-key') ||
                placeholder.toLowerCase().includes('x-api-key')) {
              input.value = apiKey;
              input.style.backgroundColor = '#f0f8f0';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // Check for X-Signature
            else if (labelText.includes('x-signature') || labelText.includes('signature') || 
                     inputId.includes('signature') || inputName.includes('signature') ||
                     placeholder.toLowerCase().includes('x-signature')) {
              input.value = signature;
              input.style.backgroundColor = '#f0f8f0';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
            // Check for X-Timestamp
            else if (labelText.includes('x-timestamp') || labelText.includes('timestamp') || 
                     inputId.includes('timestamp') || inputName.includes('timestamp') ||
                     placeholder.toLowerCase().includes('x-timestamp')) {
              input.value = timestamp;
              input.style.backgroundColor = '#f0f8f0';
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }
          });
          
          console.log('✅ HMAC headers auto-filled:', { apiKey, signature: signature.substring(0, 16) + '...', timestamp });
        } catch (error) {
          console.error('❌ Failed to generate HMAC signature:', error);
        }
      }
      
      // Watch for "Try it out" button clicks and auto-fill headers
      function setupAutoFill() {
        // Use MutationObserver to watch for when operations are expanded
        const observer = new MutationObserver(function(mutations) {
          mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
              // Check if "Try it out" button exists
              const tryItOutBtns = document.querySelectorAll('.btn.try-out__btn');
              tryItOutBtns.forEach(btn => {
                if (!btn.hasAttribute('data-hmac-listener')) {
                  btn.setAttribute('data-hmac-listener', 'true');
                  btn.addEventListener('click', function() {
                    setTimeout(() => {
                      autoFillHMACHeaders();
              // Also fill when Execute button is clicked
              const executeBtn = document.querySelector('.execute, .btn.execute');
              if (executeBtn && !executeBtn.hasAttribute('data-hmac-listener')) {
                executeBtn.setAttribute('data-hmac-listener', 'true');
                executeBtn.addEventListener('click', async function(e) {
                  // Wait a bit for Swagger UI to prepare the request
                  await new Promise(resolve => setTimeout(resolve, 50));
                  await generateAndFillHMACHeaders();
                  // Small delay to ensure headers are filled before request is sent
                  await new Promise(resolve => setTimeout(resolve, 100));
                });
              }
                    }, 100);
                  });
                }
              });
              
              // Also watch for Execute button
              const executeBtn = document.querySelector('.execute');
              if (executeBtn && !executeBtn.hasAttribute('data-hmac-listener')) {
                executeBtn.setAttribute('data-hmac-listener', 'true');
                executeBtn.addEventListener('click', async function() {
                  await generateAndFillHMACHeaders();
                });
              }
            }
          });
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      }
      
      setupAutoFill();
      
      // Intercept Swagger UI's execute request - this is the main way to inject headers
      function setupRequestInterception() {
        // Method 1: Intercept Swagger UI's executeRequest
        if (window.ui && window.ui.specActions && window.ui.specActions.executeRequest) {
          const originalExecute = window.ui.specActions.executeRequest.bind(window.ui.specActions);
          
            window.ui.specActions.executeRequest = async function(req) {
              console.log('🔍 Intercepted executeRequest:', req);

              const apiKey = localStorage.getItem('hmac_api_key');
              const apiSecret = localStorage.getItem('hmac_api_secret');
              
              // Only add HMAC headers if credentials are set and endpoint requires HMAC
              if (apiKey && apiSecret && req && req.pathName && req.pathName.includes('/transactions')) {
                // Get body from requestBody first (this is the raw string Swagger UI will send)
                let bodyString = '';
                
                if (req.requestBody) {
                  // requestBody is the raw string that will be sent
                  const rawBody = req.requestBody.trim();
                  try {
                    // Parse and normalize to match server-side normalization
                    const parsed = JSON.parse(rawBody);
                    const normalized = normalizeDeterministic(parsed);
                    bodyString = JSON.stringify(normalized);
                    console.log('📝 Using body from req.requestBody (normalized)');
                  } catch (e) {
                    // If not valid JSON, use as-is but normalize whitespace
                    bodyString = rawBody.replace(/\s+/g, ' ').trim();
                    console.log('📝 Using req.requestBody as-is (not JSON, normalized whitespace)');
                  }
                } else {
                  // Fallback: try to get from textarea
                  const bodyEditor = document.querySelector('.body-param__texteditor textarea, .opblock-body textarea, textarea[data-name="body"]');
                  if (bodyEditor && bodyEditor.value) {
                    const rawValue = bodyEditor.value.trim();
                    if (rawValue) {
                      try {
                        const parsed = JSON.parse(rawValue);
                        const normalized = normalizeDeterministic(parsed);
                        bodyString = JSON.stringify(normalized);
                        console.log('📝 Using body from textarea editor');
                      } catch (e) {
                        bodyString = rawValue;
                        console.log('📝 Using raw body from textarea (not JSON)');
                      }
                    }
                  }
                }
                
                // Ensure body is properly formatted (empty string for empty/null bodies)
                if (!bodyString || bodyString === 'null' || bodyString === 'undefined') {
                  bodyString = '';
                }
                
                const timestamp = Math.floor(Date.now() / 1000).toString();
                const payload = `${timestamp}.${bodyString}`;
                
                // Log full payload for debugging
                const payloadPreview = payload.length > 500 ? payload.substring(0, 500) + '...' : payload;
                console.log(`📝 Client payload (${payload.length} chars):`, payloadPreview);
                console.log(`📝 Body string (${bodyString.length} chars):`, bodyString.substring(0, 200) + (bodyString.length > 200 ? '...' : ''));
                console.log(`📝 Timestamp:`, timestamp);
                
                try {
                  const signature = await generateHMACSignature(payload, apiSecret);
                  
                  // Inject headers into Swagger UI's parameters object
                  if (!req.parameters) {
                    req.parameters = {};
                  }
                  
                  // Swagger UI uses "header.X-Header-Name" format for headers
                  req.parameters['header.X-API-Key'] = apiKey;
                  req.parameters['header.X-Signature'] = signature;
                  req.parameters['header.X-Timestamp'] = timestamp;
                  
                  // Also set in headers object if it exists
                  if (!req.headers) {
                    req.headers = {};
                  }
                  req.headers['X-API-Key'] = apiKey;
                  req.headers['X-Signature'] = signature;
                  req.headers['X-Timestamp'] = timestamp;
                  req.headers['x-api-key'] = apiKey;
                  req.headers['x-signature'] = signature;
                  req.headers['x-timestamp'] = timestamp;
                  
                  // Update requestBody to match what we signed (normalized version)
                  if (bodyString && req.requestBody) {
                    req.requestBody = bodyString;
                  }
                  
                  // Also log the exact signature calculation for debugging
                  console.log('✅ HMAC headers injected:', {
                    pathName: req.pathName,
                    method: req.method,
                    'x-api-key': apiKey.substring(0, 10) + '...',
                    'x-signature': signature.substring(0, 16) + '...',
                    'x-timestamp': timestamp,
                    bodyLength: bodyString.length,
                    payloadLength: payload.length,
                    payloadPreview: payload.substring(0, 100) + '...',
                    parametersKeys: Object.keys(req.parameters).filter(k => k.includes('header')),
                    requestBodyUpdated: req.requestBody ? req.requestBody.substring(0, 50) + '...' : 'not set'
                  });
                  
                  // Log the FULL payload and signature for debugging
                  console.log('🔐 Full HMAC debug info:', {
                    fullPayload: payload,
                    calculatedSignature: signature,
                    apiSecretLength: apiSecret.length,
                    apiSecretPreview: apiSecret.substring(0, 10) + '...'
                  });
                } catch (error) {
                  console.error('❌ Failed to generate HMAC signature:', error);
                }
              } else {
                if (!apiKey || !apiSecret) {
                  console.warn('⚠️ HMAC credentials not found in localStorage');
                }
              }

              return originalExecute(req);
            };
          
          console.log('✅ Swagger UI request interception set up');
        }
      }
      
      // Try to set up immediately, but also retry if Swagger UI loads later
      setupRequestInterception();
      
      // Retry setup if Swagger UI isn't ready yet
      const retrySetup = setInterval(() => {
        if (window.ui && window.ui.specActions && window.ui.specActions.executeRequest) {
          const current = window.ui.specActions.executeRequest.toString();
          if (!current.includes('HMAC headers injected')) {
            setupRequestInterception();
          }
        }
      }, 1000);
      
      // Stop retrying after 10 seconds
      setTimeout(() => clearInterval(retrySetup), 10000);
      
          // Also intercept fetch/XHR requests as a fallback
          const originalFetch = window.fetch;
          window.fetch = async function(...args) {
            const url = args[0];
            const options = args[1] || {};

            if (typeof url === 'string' && url.includes('/transactions') && options.method && options.method !== 'GET') {
              const apiKey = localStorage.getItem('hmac_api_key');
              const apiSecret = localStorage.getItem('hmac_api_secret');

              if (apiKey && apiSecret) {
                const timestamp = Math.floor(Date.now() / 1000).toString();
                let bodyString = '';

                // Get body - use the exact string if available, otherwise normalize
                if (options.body) {
                  if (typeof options.body === 'string') {
                    // Use deterministic normalization to match server
                    try {
                      const parsed = JSON.parse(options.body);
                      const normalized = normalizeDeterministic(parsed);
                      bodyString = JSON.stringify(normalized);
                    } catch {
                      bodyString = options.body;
                    }
                  } else {
                    // Normalize object
                    const normalized = normalizeDeterministic(options.body);
                    bodyString = JSON.stringify(normalized);
                  }
                }

                const payload = `${timestamp}.${bodyString}`;

                try {
                  const signature = await generateHMACSignature(payload, apiSecret);

                  if (!options.headers) {
                    options.headers = {};
                  }

                  if (options.headers instanceof Headers) {
                    options.headers.set('X-API-Key', apiKey);
                    options.headers.set('X-Signature', signature);
                    options.headers.set('X-Timestamp', timestamp);
                  } else {
                    options.headers['X-API-Key'] = apiKey;
                    options.headers['X-Signature'] = signature;
                    options.headers['X-Timestamp'] = timestamp;
                  }

                  // Update body to match what we signed
                  if (bodyString && options.body !== bodyString) {
                    options.body = bodyString;
                  }

                  console.log('📝 Fetch interception - HMAC headers added:', {
                    url,
                    method: options.method,
                    payloadLength: payload.length,
                    bodyLength: bodyString.length
                  });
                } catch (error) {
                  console.error('Failed to generate HMAC signature in fetch:', error);
                }
              }
            }

            return originalFetch.apply(this, args);
          };
      
      console.log('🔐 HMAC Swagger Plugin loaded!');
    } else {
      setTimeout(initHMACHelper, 100);
    }
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHMACHelper);
  } else {
    initHMACHelper();
  }
})();

