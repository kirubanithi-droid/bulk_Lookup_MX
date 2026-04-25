import http.server
import socketserver
import json
import dns.resolver
from concurrent.futures import ThreadPoolExecutor

PORT = 3000

class BulkMXHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/api/bulk-mx':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                data = json.loads(post_data)
                domains = data.get('domains', [])
                
                if not isinstance(domains, list) or not domains:
                    self._send_response(400, {'error': 'Please provide an array of domains.'})
                    return

                # Process lookups
                results = self._process_bulk_lookup(domains)
                
                self._send_response(200, {'results': results})
            except json.JSONDecodeError:
                self._send_response(400, {'error': 'Invalid JSON'})
            except Exception as e:
                self._send_response(500, {'error': str(e)})
        else:
            self._send_response(404, {'error': 'Not found'})

    def _send_response(self, status_code, payload):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def _process_bulk_lookup(self, domains):
        def lookup(domain):
            try:
                answers = dns.resolver.resolve(domain, 'MX')
                records = []
                for rdata in answers:
                    records.append({
                        'priority': rdata.preference,
                        'target': str(rdata.exchange).rstrip('.'),
                        'ttl': answers.rrset.ttl if hasattr(answers, 'rrset') else 'N/A'
                    })
                records.sort(key=lambda x: x['priority'])
                return {'domain': domain, 'records': records, 'error': None}
            except dns.resolver.NXDOMAIN:
                return {'domain': domain, 'records': [], 'error': 'Domain does not exist (NXDOMAIN)'}
            except dns.resolver.NoAnswer:
                return {'domain': domain, 'records': [], 'error': 'No MX records found for this domain'}
            except Exception as e:
                return {'domain': domain, 'records': [], 'error': str(e)}

        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(lookup, domains))
            
        return results

with socketserver.ThreadingTCPServer(("", PORT), BulkMXHandler) as httpd:
    print(f"Serving HTTP on port {PORT}...")
    httpd.serve_forever()
