using Voxta.Abstractions.Registration;
using Voxta.Abstractions.Security;
using Voxta.Model.Shared.Forms;

namespace Voxta.Modules.AiCyberwar.Configuration;

public class ModuleConfigurationProvider : ModuleConfigurationProviderBase, IModuleConfigurationProvider
{
    public const string DefaultGameUrl = "http://localhost:5173/";

    public static string[] FieldsRequiringReload => [];

    // The game runs on the player's own machine (D-026): `npm run dev` serves it here.
    public static readonly FormTextField GameUrl = new()
    {
        Name = "GameUrl",
        Label = "Game address",
        Text = "Where the game runs. `npm run dev` in the game's folder serves it at http://localhost:5173/.",
        DefaultValue = DefaultGameUrl,
        Placeholder = DefaultGameUrl,
        ValidationRegex = FormTextField.UrlRegex,
        AdminOnly = true,
    };

    public Task<FormField[]> GetModuleConfigurationFieldsAsync(
        IAuthenticationContext auth,
        ISettingsSource settings,
        CancellationToken cancellationToken
    )
    {
        return Task.FromResult(FormBuilder.Build(
            FormTitleField.Create("AI Cyberwar"),
            GameUrl
        ));
    }

    /// <summary>The game's address from a module's settings: http(s) only, else the default.</summary>
    public static string GameUrlOf(Dictionary<string, string> configuration)
    {
        var value = new StaticSettingsSource(configuration).GetOptional(GameUrl)?.Trim();
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? uri.GetLeftPart(UriPartial.Path)
            : DefaultGameUrl;
    }
}
