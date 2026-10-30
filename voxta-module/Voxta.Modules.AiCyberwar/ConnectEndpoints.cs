using System.Text.Json;
using Voxta.Abstractions.Modules;
using Voxta.Abstractions.Repositories;
using Voxta.Modules.AiCyberwar.Configuration;

namespace Voxta.Modules.AiCyberwar;

// On Voxta's own address, for a signed-in player only. Other websites are refused by Voxta before this runs, unless the
// account allows external apps, which already lets every website do anything.
//   GET connect?module=<id>          makes a chat-only key and sends the browser to the game with it after the '#'
//   GET ai-cyberwar-preset.json      the chat preset to import (the one step a module can't do)
public class ConnectEndpoints(IUnitOfWorkFactory unitOfWorkFactory) : IModuleHttpEndpoints
{
    public const string Prefix = "ai-cyberwar";

    // Specific, so keys a player named themselves are never the ones deleted.
    private const string KeyName = "AI Cyberwar (Voxta module)";

    public string RoutePrefix => Prefix;

    public async Task<ModuleHttpResponse?> HandleAsync(ModuleHttpRequest request, CancellationToken cancellationToken)
    {
        switch (request.Method, request.Path)
        {
            case ("GET", "connect"):
                var modules = await unitOfWorkFactory.ReadAsync(request.UserId, x => x.Modules.GetManyByServiceNameAsync(VoxtaModule.ServiceName, cancellationToken));
                var module = modules.FirstOrDefault(m => m.Id.ToString() == request.Query.GetValueOrDefault("module")) ?? modules.FirstOrDefault();
                if (module == null) return Page("Add the AI Cyberwar module to your Voxta account first.", null);
                // From the module's settings, never from the address: the key goes nowhere a link could choose.
                return Page(null, ModuleConfigurationProvider.GameUrlOf(module.Configuration));
            case ("GET", "ai-cyberwar-preset.json"):
                await using (var preset = typeof(VoxtaModule).Assembly.GetManifestResourceStream("ai-cyberwar-preset.json")!)
                using (var reader = new StreamReader(preset))
                    return new ModuleHttpResponse(200, "application/octet-stream", await reader.ReadToEndAsync(cancellationToken));
            default:
                return null;
        }
    }

    private static ModuleHttpResponse Page(string? error, string? gameUrl) => ModuleHttpResponse.Html($$"""
        <!DOCTYPE html>
        <html lang="en"><head><meta charset="utf-8"><title>AI Cyberwar: connecting to Voxta</title>
        <style>body{background:#060910;color:#dbe6f3;font:16px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0}
        p{max-width:36em;text-align:center}.error{color:#ff6259}</style></head>
        <body><p id="status">{{(error == null ? "Connecting the game to Voxta…" : "")}}</p>
        <script>
        const status = document.getElementById('status');
        const error = {{JsonSerializer.Serialize(error)}};
        const game = {{JsonSerializer.Serialize(gameUrl)}};
        const fail = (text) => { status.textContent = text; status.className = 'error'; };
        (async () => {
          if (error) return fail(error);
          try {
            // One key per player: the one from the last Play is replaced.
            const list = await fetch('/api/api-keys');
            if (!list.ok) return fail('Voxta refused to list your API keys (' + list.status + '). Sign in to Voxta in this browser, then press Play again.');
            for (const k of (await list.json()).apiKeys ?? []) {
              if (k.name === {{JsonSerializer.Serialize(KeyName)}}) await fetch('/api/api-keys/' + k.id, { method: 'DELETE' });
            }
            const made = await fetch('/api/api-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: {{JsonSerializer.Serialize(KeyName)}}, scopes: ['chat'] }) });
            if (!made.ok) return fail('Voxta could not make a key for the game (' + made.status + '): ' + await made.text());
            const target = new URL(game);
            // The game assumes Voxta's default port; tell it otherwise.
            if (location.port && location.port !== '5384') target.searchParams.set('voxtaPort', location.port);
            // After the '#': browsers never send it to a server, and the game removes it from the address at once.
            target.hash = 'voxta-key=' + encodeURIComponent((await made.json()).key);
            location.replace(target.href);
          } catch (e) {
            fail('Could not connect the game: ' + e);
          }
        })();
        </script></body></html>
        """);
}
