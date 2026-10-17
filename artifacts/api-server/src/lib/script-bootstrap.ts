export function scriptBootstrap(slug: string) {
  if (!/^[a-z0-9]{8}$/.test(slug)) throw new Error("Invalid script slug");
  return `-- CocoX Code Redeemer: a redeemed key is required.
local env = (type(getgenv) == "function" and getgenv()) or _G
local key = CocoX_Key or env.CocoX_Key or _G.CocoX_Key
if type(key) ~= "string" or key == "" then error("Set CocoX_Key before running this loader.", 0) end
local http = request or http_request or (syn and syn.request) or (fluxus and fluxus.request)
if type(http) ~= "function" then error("This executor does not support HTTP POST.", 0) end
local device
if type(gethwid) == "function" then
  local ok, value = pcall(gethwid)
  if ok and type(value) == "string" and value ~= "" then device = value end
end
if not device then
  local ok, value = pcall(function() return game:GetService("RbxAnalyticsService"):GetClientId() end)
  if ok and type(value) == "string" and value ~= "" then device = value end
end
if not device then error("A stable device identifier is required for this key.", 0) end
local json = game:GetService("HttpService")
local ok, response = pcall(http, {
  Url = "https://cocox.wtf/api/script-executions",
  Method = "POST",
  Headers = {["Content-Type"] = "application/json"},
  Body = json:JSONEncode({slug = "${slug}", key = key, hwid = device})
})
if not ok or type(response) ~= "table" then error("CocoX could not be reached. Try again later.", 0) end
if tonumber(response.StatusCode) ~= 200 then
  local parsed, body = pcall(function() return json:JSONDecode(response.Body or "{}") end)
  error((parsed and type(body) == "table" and body.error) or "CocoX rejected this key.", 0)
end
local fn, reason = loadstring(response.Body)
if not fn then error(reason or "The uploaded script is not valid Lua.", 0) end
return fn()
`;
}
