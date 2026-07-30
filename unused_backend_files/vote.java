import java.util.Scanner; // Import the tool to read input

public class Main {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        
        System.out.print("Enter voter name: ");
        String name = input.nextLine();
        
        System.out.println("Voter " + name + " is now registered in the system!");
        
        input.close();
    }
}
