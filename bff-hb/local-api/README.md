# External Resource API

This folder contains a resource API that is called by <em>all</em> of the architecture demos (BFF, TMB, and BBOC). It represents an external resource server that does not share an origin with FusionAuth or with any of the application architectures.

The API only has one endpoint (`/api/recipe`) which is secured with `Authorization` header access tokens. It returns a randomly-generated recipe in a JSON response.

## Installation

1. In your filesystem, open a console in the `auth-architecture/resource-api` folder
2. Remove the `.sample` suffix from `.env.sample` and make the changes specified in the file
3. Run `npm install`
4. Run `npm run dev` to start the resource server

## Server URL Configuration

The resource server is meant to simulate cross-origin requests. Browsers resolve all `localhost` ports as the same origin, so CORS cannot be tested with all parties running on `localhost`. Below is an option to update your `hosts` file on your machine to add an entry that makes the resource server accessible at `http://resource-api.local:5001`. The resource server will automatically try to use `http://resource-api.local:5001` if available, and fall back to `http://localhost:5001` if not. To use the custom domain, you need to update your system's hosts file.

### Option 1: Use Custom Domain (Recommended)

To enable `resource-api.local`, add the following entry to your system's hosts file:

```
127.0.0.1 resource-api.local
```

#### Windows (PC) - Editing Hosts File

1. **Open Notepad as Administrator:**
   - Press `Win + R`, type `notepad`, then press `Ctrl + Shift + Enter`
   - Or right-click Notepad in Start Menu and select "Run as administrator"

2. **Open the hosts file:**
   - In Notepad: File → Open
   - Navigate to: `C:\Windows\System32\drivers\etc\`
   - Change file type filter to "All Files (*.*)"
   - Select and open the `hosts` file

3. **Add the entry:**
   - Add this line at the end: `127.0.0.1 resource-api.local`

4. **Save:** Press `Ctrl + S`

#### Mac/Linux - Editing Hosts File

1. **Open Terminal**

2. **Edit with sudo:**
   ```bash
   sudo nano /etc/hosts
   ```

3. **Add the entry:**
   - Add this line at the end: `127.0.0.1 resource-api.local`

4. **Save and exit:**
   - Press `Ctrl + X`, then `Y`, then `Enter`

5. **Flush DNS cache (optional):**
   ```bash
   sudo dscacheutil -flushcache
   ```

#### Testing Your Setup

After updating your hosts file, test the configuration:

- **Ping test:** `ping resource-api.local`
- **Browser test:** Visit `http://resource-api.local:5001` (after starting the server)

### Option 2: Use Localhost (Default Fallback)

If you don't want to modify your hosts file, the server will automatically fall back to `http://localhost:5001`, but the requests won't be cross-origin.

## Usage Notes

- The server will display which URL it's using when it starts up
- No restart required after updating hosts file - changes take effect immediately
- This is a resource API; it does not have a browser component