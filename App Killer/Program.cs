using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Threading;

//====================================================================================================================================================================================================================================//
// App Name: App Killer                                                                                                                                                                                                               //
// Developer and Creator: Tyler Whisinnand                                                                                                                                                                                            //
// Date: November 27th, 2018                                                                                                                                                                                                          //
// Purpose: Allows the user to forcibly kill an application that task manager fails to end (via end task button). User types in the name of the program or app that is in the parentheses and hits enter; the program will be killed. //
// Copyright ©Tyler Whisinnand 2018                                                                                                                                                                                                   //
// You may download, use, modify, and redistribute this software, but the sale or transfer of money for said software is forbidden. If you modify this software; you must credit the creator, Tyler Whisinnand. Open Source.          //
// Written in C# .NET Framework 4.6.1                                                                                                                                                                                                 //
//====================================================================================================================================================================================================================================//

namespace App_Killer
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Please type in the program name (the name in parentheses) to kill it. " + "\n");

            Program Kill = new Program();
            Program Display = new Program();
            Display.DisplayTasks();
            Kill.KillTask();
        }

        public void DisplayTasks()
        {
            foreach (var Process in Process.GetProcesses())
            {
                Console.WriteLine(Process); // Displays a list of applications that are currently running to the user.
            }
            Console.WriteLine("\n");
        }

        public void KillTask()
        {
            var USER_PROCESS = Console.ReadLine(); // Takes in user input
            foreach (var PROCESS_NAME in Process.GetProcessesByName(USER_PROCESS))
            {
                Console.WriteLine("Killed " + PROCESS_NAME); // Displays to the user that the program they typed in was killed. i.e. "Killed Spotify".
                PROCESS_NAME.Kill();
            }

            Console.WriteLine("\n" + "Press any key to exit the program."); // Any key press will close this program.
            Console.ReadKey();

        }
    }
}
