using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Voxta.Abstractions.Exporting.Import;
using Voxta.Abstractions.Registration;
using Voxta.Abstractions.Repositories;
using Voxta.Abstractions.Services.Launchers;
using Voxta.Modules.AiCyberwar.Configuration;

namespace Voxta.Modules.AiCyberwar;

/// <summary>
/// The game in the Play library. Play installs The Model and opens the connect page in the browser, which hands the
/// game a key. Voxta can't see a browser tab, so whether the game is running is unknown; it tells whether the game's
/// address answers instead.
/// </summary>
public class GameLauncher(IUnitOfWorkFactory unitOfWorkFactory, IAppResourceDeployer deployer, IServer server) : ILauncher
{
    private static readonly HttpClient Probe = new() { Timeout = TimeSpan.FromSeconds(1) };
    private static readonly TimeSpan ProbeFor = TimeSpan.FromSeconds(5);

    // The library asks every few seconds; one probe per address per few seconds is plenty.
    private readonly ConcurrentDictionary<string, (bool Up, DateTimeOffset At)> _probes = new();

    public string ServiceName => VoxtaModule.ServiceName;

    public ModuleLogo Cover { get; } = ModuleLogo.EmbeddedResource(typeof(VoxtaModule), "Assets.Cover.svg");

    // The game talks to Voxta's hub itself, with the key the connect page gave it.
    public string? ChatBridgeServiceName => null;

    public async Task<IReadOnlyList<LauncherStatus>> GetStatusAsync(Guid userId, CancellationToken cancellationToken)
    {
        var modules = await unitOfWorkFactory.ReadAsync(userId, x => x.Modules.GetManyByServiceNameAsync(ServiceName, cancellationToken));
        var statuses = new List<LauncherStatus>();
        foreach (var module in modules)
        {
            var url = ModuleConfigurationProvider.GameUrlOf(module.Configuration);
            statuses.Add(new LauncherStatus
            {
                ModuleId = module.Id,
                Running = null,
                CanLaunch = true,
                Detail = await AnswersAsync(url, cancellationToken)
                    ? $"Opens in your browser at {url}"
                    : $"Start the game first: npm run dev in its folder ({url} isn't answering).",
            });
        }
        return statuses;
    }

    public async Task LaunchAsync(Guid userId, Guid moduleId, CancellationToken cancellationToken)
    {
        var module = await unitOfWorkFactory.ReadAsync(userId, x => x.Modules.GetByIdAsync(moduleId, cancellationToken));
        if (module?.ServiceName != ServiceName) throw new InvalidOperationException("Not an AI Cyberwar module.");
        var url = ModuleConfigurationProvider.GameUrlOf(module.Configuration);
        _probes.TryRemove(url, out _);
        if (!await AnswersAsync(url, cancellationToken))
            throw new InvalidOperationException($"The game isn't running at {url}. In the game's folder, run npm run dev, then press Play again.");

        // Writes nothing while the installed character is current, and keeps the player's edits.
        await using (var package = typeof(VoxtaModule).Assembly.GetManifestResourceStream("TheModel.voxpak")!)
            await deployer.DeployPackageAsync(userId, package, cancellationToken);

        var voxta = VoxtaUrl() ?? throw new InvalidOperationException("Voxta's own address is unknown.");
        // The browser opens on the machine Voxta runs on, which is where the game runs too (D-026).
        Process.Start(new ProcessStartInfo($"{voxta}/api/extensions/{ConnectEndpoints.Prefix}/connect?module={moduleId}") { UseShellExecute = true });
    }

    private async Task<bool> AnswersAsync(string url, CancellationToken cancellationToken)
    {
        if (_probes.TryGetValue(url, out var probe) && DateTimeOffset.UtcNow - probe.At < ProbeFor) return probe.Up;
        bool up;
        try
        {
            using var response = await Probe.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            up = true;
        }
        catch (Exception exc) when (exc is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            up = false;
        }
        _probes[url] = (up, DateTimeOffset.UtcNow);
        return up;
    }

    // The address Voxta listens on, as a browser on this machine reaches it.
    private string? VoxtaUrl()
    {
        string? fallback = null;
        foreach (var address in server.Features.Get<IServerAddressesFeature>()?.Addresses ?? [])
        {
            if (!Uri.TryCreate(address, UriKind.Absolute, out var uri)) continue;
            var host = uri.Host is "*" or "+" or "0.0.0.0" or "[::]" ? "localhost" : uri.Host;
            var resolved = $"{uri.Scheme}://{host}:{uri.Port}";
            if (uri.Scheme == Uri.UriSchemeHttp) return resolved;
            fallback ??= resolved;
        }
        return fallback;
    }
}
