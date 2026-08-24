using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnableFront.Builder.Migrations
{
    /// <inheritdoc />
    public partial class AddImageUrlToSeries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Series",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Series");
        }
    }
}
