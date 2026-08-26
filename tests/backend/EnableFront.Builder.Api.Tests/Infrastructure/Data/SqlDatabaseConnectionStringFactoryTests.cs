using EnableFront.Builder.Infrastructure.Data;

namespace EnableFront.Builder.Api.Tests.Infrastructure.Data;

public class SqlDatabaseConnectionStringFactoryTests
{
    [Fact]
    public void Create_WithActiveDirectoryDefaultAuthentication_OmitsCredentialsAndSetsAuthenticationProperty()
    {
        var options = new SqlDatabaseOptions
        {
            Server = "sql-server.database.windows.net",
            Database = "enablemint",
            Authentication = SqlDatabaseAuthentication.ActiveDirectoryDefault,
            TrustServerCertificate = false
        };

        var connectionString = SqlDatabaseConnectionStringFactory.Create(options);

        Assert.Contains("Data Source=sql-server.database.windows.net", connectionString);
        Assert.Contains("Initial Catalog=enablemint", connectionString);
        Assert.Contains("Authentication=ActiveDirectoryDefault", connectionString);
        Assert.DoesNotContain("User ID=", connectionString);
        Assert.DoesNotContain("Password=", connectionString);
        Assert.DoesNotContain("Integrated Security", connectionString);
    }

    [Fact]
    public void Create_WithIntegratedAuthentication_UsesTrustedConnectionForLocalDevelopment()
    {
        var options = new SqlDatabaseOptions
        {
            Server = @"(local)\SQLEXPRESS",
            Database = "EnableFrontBuilder",
            Authentication = SqlDatabaseAuthentication.Integrated,
            TrustServerCertificate = true
        };

        var connectionString = SqlDatabaseConnectionStringFactory.Create(options);

        Assert.Contains(@"Data Source=(local)\SQLEXPRESS", connectionString);
        Assert.Contains("Initial Catalog=EnableFrontBuilder", connectionString);
        Assert.Contains("Integrated Security=True", connectionString);
        Assert.Contains("Trust Server Certificate=True", connectionString);
        Assert.DoesNotContain("Authentication=", connectionString);
    }
}

