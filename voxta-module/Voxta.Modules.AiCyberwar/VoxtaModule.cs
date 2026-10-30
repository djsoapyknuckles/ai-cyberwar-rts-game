using Microsoft.Extensions.DependencyInjection;
using Voxta.Abstractions.Modules;
using Voxta.Abstractions.Registration;
using Voxta.Abstractions.Services.Launchers;
using Voxta.Modules.AiCyberwar.Configuration;

namespace Voxta.Modules.AiCyberwar;

// The installer around the game (D-026): installs The Model, hands the browser game a chat key, and puts the game in
// the Play library. The game itself runs on the player's machine and talks to Voxta's hub on its own.
public class VoxtaModule : IVoxtaModule
{
    public const string ServiceName = "AiCyberwar";

    public void Configure(IVoxtaModuleBuilder builder)
    {
        builder.Register(new()
        {
            ServiceName = ServiceName,
            Label = "AI Cyberwar",
            Version = ModuleInfo.Version,
            Flags = [ModuleFlag.Experimental, ModuleFlag.InstallsWithoutSettings],
            Supports = new()
            {
                Launcher = new(ServiceDefinitionCategoryScore.Low),
            },
            Pricing = ServiceDefinitionPricing.Free,
            Hosting = ServiceDefinitionHosting.Builtin,
            Notes = "An open-source RTS against The Model, a character who commands the AI and taunts you out loud. The game runs in your browser on this machine.",
            HelpLink = "https://github.com/djsoapyknuckles/ai-cyberwar-rts-game",
            Logo = ModuleLogo.EmbeddedResource(typeof(VoxtaModule), "Assets.Logo.png"),
            Onboarding = ModuleOnboarding.EmbeddedResource(typeof(VoxtaModule), "Assets.Onboarding.md"),
            ModuleConfigurationProviderType = typeof(ModuleConfigurationProvider),
            ModuleConfigurationFieldsRequiringReload = ModuleConfigurationProvider.FieldsRequiringReload,
        });

        builder.Services.AddSingleton<GameLauncher>();
        builder.Contribute<ILauncher>(sp => sp.GetRequiredService<GameLauncher>());
        builder.Contribute<IModuleHttpEndpoints, ConnectEndpoints>();
    }
}
