using Microsoft.Data.SqlClient;

namespace EnableFront.Builder.Infrastructure.Data;

/// <summary>
/// Supported SQL Server authentication modes for the API's database connection.
/// </summary>
public enum SqlDatabaseAuthentication
{
    /// <summary>
    /// Windows-integrated authentication, used for local development (e.g. SQL Server Express).
    /// </summary>
    Integrated,

    /// <summary>
    /// Microsoft Entra authentication resolved via the App Service system-assigned managed identity
    /// (or another credential in the DefaultAzureCredential chain during local testing).
    /// </summary>
    ActiveDirectoryDefault
}

/// <summary>
/// Configuration bound from the "SqlDatabase" configuration section.
/// </summary>
public class SqlDatabaseOptions
{
    public const string SectionName = "SqlDatabase";

    public required string Server { get; set; }

    public required string Database { get; set; }

    public SqlDatabaseAuthentication Authentication { get; set; } = SqlDatabaseAuthentication.Integrated;

    public bool TrustServerCertificate { get; set; }
}

/// <summary>
/// Builds SQL Server connection strings without ever embedding a SQL password. Production
/// deployments use Microsoft Entra authentication via the deployed managed identity; local
/// development uses Windows-integrated authentication.
/// </summary>
public static class SqlDatabaseConnectionStringFactory
{
    public static string Create(SqlDatabaseOptions options)
    {
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = options.Server,
            InitialCatalog = options.Database,
            TrustServerCertificate = options.TrustServerCertificate,
            MultipleActiveResultSets = true
        };

        switch (options.Authentication)
        {
            case SqlDatabaseAuthentication.ActiveDirectoryDefault:
                builder.Authentication = SqlAuthenticationMethod.ActiveDirectoryDefault;
                break;
            case SqlDatabaseAuthentication.Integrated:
                builder.IntegratedSecurity = true;
                break;
            default:
                throw new ArgumentOutOfRangeException(
                    nameof(options),
                    options.Authentication,
                    "Unsupported SQL database authentication mode.");
        }

        return builder.ConnectionString;
    }
}
