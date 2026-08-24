using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnableFront.Builder.Migrations
{
    /// <inheritdoc />
    public partial class AddDescriptionToSession : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Sessions",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Sessions");
        }
    }
}
